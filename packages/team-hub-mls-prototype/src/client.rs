//! MLS client wrapper for a single Team Hub device participating in a
//! discussion thread group.

use openmls::prelude::*;
use openmls::prelude::tls_codec::{Deserialize, Serialize};
use openmls_basic_credential::SignatureKeyPair;
use openmls_rust_crypto::OpenMlsRustCrypto;
use thiserror::Error;

/// Crypto/storage provider used by the prototype clients.
pub type Provider = OpenMlsRustCrypto;

/// Stable identity for a hub user device enrolled in MLS.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeviceIdentity {
    /// Hub-scoped user id, e.g. `user-123`.
    pub user_id: String,
    /// Per-device id within the hub, e.g. `laptop` or `phone`.
    pub device_id: String,
}

impl DeviceIdentity {
    /**
     * Builds the MLS basic-credential identity bytes for this device.
     */
    pub fn credential_bytes(&self) -> Vec<u8> {
        format!("{}#{}", self.user_id, self.device_id).into_bytes()
    }
}

/// A decrypted discussion comment body plus sender metadata.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessedComment {
    pub sender_user_id: String,
    pub sender_device_id: String,
    pub body: Vec<u8>,
}

/// Errors surfaced by the prototype MLS client wrapper.
#[derive(Debug, Error)]
pub enum ClientError {
    #[error("{0}")]
    Failed(String),
    #[error("expected an application message")]
    NotApplicationMessage,
    #[error("group is no longer active for this device")]
    InactiveGroup,
    #[error("device is not enrolled in a group")]
    NotInGroup,
}

/**
 * One enrolled device holding local MLS group state for a discussion thread.
 */
pub struct DiscussionMlsClient {
    identity: DeviceIdentity,
    credential: CredentialWithKey,
    signer: SignatureKeyPair,
    provider: Provider,
    group: Option<MlsGroup>,
}

impl DiscussionMlsClient {
    /**
     * Prepares a device identity and local key material before group enrollment.
     */
    pub fn prepare_device(
        identity: DeviceIdentity,
        ciphersuite: Ciphersuite,
    ) -> Result<Self, ClientError> {
        let provider = Provider::default();
        let (credential, signer) = Self::generate_credential(&provider, &identity, ciphersuite)?;
        Ok(Self {
            identity,
            credential,
            signer,
            provider,
            group: None,
        })
    }

    /**
     * Creates a new discussion MLS group on this device and returns the
     * creator client plus serialized welcome artifacts for future members.
     */
    pub fn create_group(
        identity: DeviceIdentity,
        group_id: &[u8],
        ciphersuite: Ciphersuite,
    ) -> Result<(Self, SerializedGroupArtifacts), ClientError> {
        let mut client = Self::prepare_device(identity, ciphersuite)?;
        let config = MlsGroupCreateConfig::builder()
            .ciphersuite(ciphersuite)
            .use_ratchet_tree_extension(true)
            .build();

        let group = mls(MlsGroup::new_with_group_id(
            &client.provider,
            &client.signer,
            &config,
            GroupId::from_slice(group_id),
            client.credential.clone(),
        ))?;
        client.group = Some(group);

        Ok((
            client,
            SerializedGroupArtifacts {
                ratchet_tree: Vec::new(),
            },
        ))
    }

    /**
     * Generates a KeyPackage for this device so another member can add it.
     */
    pub fn generate_key_package(
        &self,
        ciphersuite: Ciphersuite,
    ) -> Result<KeyPackage, ClientError> {
        Ok(
            mls(KeyPackage::builder().build(
                ciphersuite,
                &self.provider,
                &self.signer,
                self.credential.clone(),
            ))?
            .key_package()
            .clone(),
        )
    }

    /**
     * Adds another device's KeyPackage, merges locally, and returns commit and
     * welcome bytes for relay delivery.
     */
    pub fn add_device(
        &mut self,
        key_package: &KeyPackage,
    ) -> Result<AddDeviceOutcome, ClientError> {
        let Self {
            provider,
            signer,
            group,
            ..
        } = self;
        let group = group.as_mut().ok_or(ClientError::NotInGroup)?;
        let (commit, welcome, _group_info) = mls(group.add_members(
            provider,
            signer,
            core::slice::from_ref(key_package),
        ))?;
        mls(group.merge_pending_commit(provider))?;

        Ok(AddDeviceOutcome {
            commit_bytes: mls(commit.to_bytes())?,
            welcome_bytes: mls(welcome.to_bytes())?,
            ratchet_tree: mls(group.export_ratchet_tree().tls_serialize_detached())?,
        })
    }

    /**
     * Joins an existing discussion group from a welcome message and ratchet tree.
     *
     * The same device instance that generated the KeyPackage must call this so
     * the local key store matches the welcome.
     */
    pub fn join_from_welcome(
        &mut self,
        ciphersuite: Ciphersuite,
        welcome_bytes: Vec<u8>,
        ratchet_tree_bytes: Option<Vec<u8>>,
    ) -> Result<(), ClientError> {
        let join_config = MlsGroupJoinConfig::builder()
            .use_ratchet_tree_extension(true)
            .build();

        let welcome_message = MlsMessageIn::tls_deserialize_exact(welcome_bytes)
            .map_err(|error| ClientError::Failed(error.to_string()))?;
        let welcome = welcome_message
            .into_welcome()
            .ok_or(ClientError::NotApplicationMessage)?;

        let ratchet_tree = ratchet_tree_bytes.map(|bytes| {
            RatchetTreeIn::tls_deserialize_exact(bytes).expect("invalid ratchet tree bytes")
        });

        let staged = mls(StagedWelcome::new_from_welcome(
            &self.provider,
            &join_config,
            welcome,
            ratchet_tree,
        ))?;
        let group = mls(staged.into_group(&self.provider))?;
        self.group = Some(group);
        let _ = ciphersuite;
        Ok(())
    }

    /**
     * Encrypts a discussion comment body into an MLS application message.
     */
    pub fn encrypt_comment(&mut self, body: &[u8]) -> Result<Vec<u8>, ClientError> {
        let Self {
            provider,
            signer,
            group,
            ..
        } = self;
        let group = group.as_mut().ok_or(ClientError::NotInGroup)?;
        if !group.is_active() {
            return Err(ClientError::InactiveGroup);
        }

        let message = mls(group.create_message(provider, signer, body))?;
        Ok(mls(message.to_bytes())?)
    }

    /**
     * Decrypts an MLS application message into a discussion comment body.
     */
    pub fn decrypt_comment(&mut self, message_bytes: &[u8]) -> Result<ProcessedComment, ClientError> {
        let Self {
            provider,
            group,
            ..
        } = self;
        let group = group.as_mut().ok_or(ClientError::NotInGroup)?;
        let inbound = MlsMessageIn::tls_deserialize_exact(message_bytes)
            .map_err(|error| ClientError::Failed(error.to_string()))?;
        let protocol_message = mls(inbound.try_into_protocol_message())?;
        let processed = mls(group.process_message(provider, protocol_message))?;
        let sender = processed.credential().serialized_content();
        let (user_id, device_id) = parse_identity_bytes(sender)?;

        match processed.into_content() {
            ProcessedMessageContent::ApplicationMessage(message) => Ok(ProcessedComment {
                sender_user_id: user_id,
                sender_device_id: device_id,
                body: message.into_bytes(),
            }),
            _ => Err(ClientError::NotApplicationMessage),
        }
    }

    /**
     * Removes another member and returns the commit bytes every remaining device
     * must process before future comments can be decrypted.
     */
    pub fn remove_member(
        &mut self,
        target_leaf_index: LeafNodeIndex,
    ) -> Result<Vec<u8>, ClientError> {
        let Self {
            provider,
            signer,
            group,
            ..
        } = self;
        let group = group.as_mut().ok_or(ClientError::NotInGroup)?;
        let (commit, _welcome, _group_info) = mls(group.remove_members(
            provider,
            signer,
            core::slice::from_ref(&target_leaf_index),
        ))?;
        mls(group.merge_pending_commit(provider))?;
        Ok(mls(commit.to_bytes())?)
    }

    /**
     * Applies a remove/add commit delivered through the relay.
     */
    pub fn process_commit(&mut self, commit_bytes: &[u8]) -> Result<(), ClientError> {
        let Self {
            provider,
            group,
            ..
        } = self;
        let group = group.as_mut().ok_or(ClientError::NotInGroup)?;
        let inbound = MlsMessageIn::tls_deserialize_exact(commit_bytes)
            .map_err(|error| ClientError::Failed(error.to_string()))?;
        let protocol_message = mls(inbound.try_into_protocol_message())?;
        let processed = mls(group.process_message(provider, protocol_message))?;

        if let ProcessedMessageContent::StagedCommitMessage(staged_commit) = processed.into_content()
        {
            mls(group.merge_staged_commit(provider, *staged_commit))?;
            Ok(())
        } else {
            Err(ClientError::NotApplicationMessage)
        }
    }

    /** Returns this device's leaf index inside the MLS group. */
    pub fn own_leaf_index(&self) -> LeafNodeIndex {
        self.group
            .as_ref()
            .expect("group should exist")
            .own_leaf_index()
    }

    /** Returns whether this device can still send encrypted comments. */
    pub fn is_active(&self) -> bool {
        self.group
            .as_ref()
            .map(|group| group.is_active())
            .unwrap_or(false)
    }

    /** Returns the current MLS epoch for relay metadata. */
    pub fn epoch(&self) -> GroupEpoch {
        self.group
            .as_ref()
            .expect("group should exist")
            .epoch()
    }

    /** Returns the hub user id for this enrolled client. */
    pub fn user_id(&self) -> &str {
        &self.identity.user_id
    }

    /** Returns the device id for this enrolled client. */
    pub fn device_id(&self) -> &str {
        &self.identity.device_id
    }

    fn generate_credential(
        provider: &Provider,
        identity: &DeviceIdentity,
        ciphersuite: Ciphersuite,
    ) -> Result<(CredentialWithKey, SignatureKeyPair), ClientError> {
        let credential = BasicCredential::new(identity.credential_bytes());
        let signer = mls(SignatureKeyPair::new(ciphersuite.signature_algorithm()))?;
        mls(signer.store(provider.storage()))?;
        Ok((
            CredentialWithKey {
                credential: credential.into(),
                signature_key: signer.to_public_vec().into(),
            },
            signer,
        ))
    }
}

/**
 * Serialized artifacts produced when a discussion MLS group is created.
 */
#[derive(Debug, Clone, Default)]
pub struct SerializedGroupArtifacts {
    pub ratchet_tree: Vec<u8>,
}

/**
 * Commit and welcome bytes produced when a device is added to a group.
 */
#[derive(Debug, Clone)]
pub struct AddDeviceOutcome {
    pub commit_bytes: Vec<u8>,
    pub welcome_bytes: Vec<u8>,
    pub ratchet_tree: Vec<u8>,
}

fn mls<T, E: std::fmt::Display>(result: Result<T, E>) -> Result<T, ClientError> {
    result.map_err(|error| ClientError::Failed(error.to_string()))
}

fn parse_identity_bytes(bytes: &[u8]) -> Result<(String, String), ClientError> {
    let value = String::from_utf8(bytes.to_vec()).map_err(|_| ClientError::NotApplicationMessage)?;
    let (user_id, device_id) = value
        .split_once('#')
        .ok_or(ClientError::NotApplicationMessage)?;
    Ok((user_id.to_string(), device_id.to_string()))
}
