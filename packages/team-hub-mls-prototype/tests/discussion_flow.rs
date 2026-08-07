//! End-to-end prototype flow for Team Hub encrypted discussions.
//!
//! Covers group creation, second-device enrollment, encrypted comment relay,
//! decrypt on another client, member removal, and post-removal decrypt failure.

use openmls_traits::types::Ciphersuite;
use team_hub_mls_prototype::{
    client::{AddDeviceOutcome, DeviceIdentity, DiscussionMlsClient},
    relay::{FakeRelay, RelayEnvelope, RelayEvent},
};

const DISCUSSION_ID: &str = "request:req-123:discussion";
const GROUP_ID: &[u8] = b"team-hub-discussion-req-123";
const CIPHERSUITE: Ciphersuite = Ciphersuite::MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519;

#[test]
fn discussion_flow() {
    let mut relay = FakeRelay::default();

    // Alice laptop creates the discussion MLS group.
    let (mut alice_laptop, _artifacts) = DiscussionMlsClient::create_group(
        DeviceIdentity {
            user_id: "alice".into(),
            device_id: "laptop".into(),
        },
        GROUP_ID,
        CIPHERSUITE,
    )
    .expect("alice laptop creates group");

    // Alice phone enrolls as a second device via KeyPackage + welcome relay path.
    let mut alice_phone = DiscussionMlsClient::prepare_device(
        DeviceIdentity {
            user_id: "alice".into(),
            device_id: "phone".into(),
        },
        CIPHERSUITE,
    )
    .expect("alice phone prepares device");
    let alice_phone_kp = alice_phone
        .generate_key_package(CIPHERSUITE)
        .expect("phone key package");

    let AddDeviceOutcome {
        commit_bytes,
        welcome_bytes,
        ratchet_tree,
    } = alice_laptop
        .add_device(&alice_phone_kp)
        .expect("alice laptop adds alice phone");

    relay.post_commit(
        DISCUSSION_ID,
        alice_laptop.epoch().as_u64(),
        commit_bytes.clone(),
    );

    let welcome_delivery = relay.post_welcome(
        DISCUSSION_ID,
        "phone",
        welcome_bytes,
        ratchet_tree,
    );
    assert_eq!(
        welcome_delivery.events,
        vec![RelayEvent::WelcomePosted {
            discussion_id: DISCUSSION_ID.into(),
            recipient_device_id: "phone".into(),
        }]
    );

    let RelayEnvelope::Welcome {
        ciphertext: welcome_from_relay,
        ratchet_tree: tree_from_relay,
        ..
    } = welcome_delivery.envelope
    else {
        panic!("expected welcome envelope");
    };

    alice_phone
        .join_from_welcome(CIPHERSUITE, welcome_from_relay, Some(tree_from_relay))
        .expect("alice phone joins from relayed welcome");

    // Bob joins as a separate user/device so we can test cross-client decrypt.
    let mut bob = DiscussionMlsClient::prepare_device(
        DeviceIdentity {
            user_id: "bob".into(),
            device_id: "desktop".into(),
        },
        CIPHERSUITE,
    )
    .expect("bob prepares device");
    let bob_kp = bob
        .generate_key_package(CIPHERSUITE)
        .expect("bob key package");

    let bob_add = alice_laptop
        .add_device(&bob_kp)
        .expect("alice laptop adds bob");
    relay.post_commit(
        DISCUSSION_ID,
        alice_laptop.epoch().as_u64(),
        bob_add.commit_bytes.clone(),
    );
    relay.post_welcome(
        DISCUSSION_ID,
        "desktop",
        bob_add.welcome_bytes.clone(),
        bob_add.ratchet_tree.clone(),
    );

    bob.join_from_welcome(
        CIPHERSUITE,
        bob_add.welcome_bytes,
        Some(bob_add.ratchet_tree),
    )
    .expect("bob joins from relayed welcome");

    alice_phone
        .process_commit(&bob_add.commit_bytes)
        .expect("alice phone processes bob add commit");

    // Alice laptop encrypts a comment and the relay stores only ciphertext.
    let comment_body = b"Can someone review the failing assertion?";
    let ciphertext = alice_laptop
        .encrypt_comment(comment_body)
        .expect("encrypt comment");
    let comment_delivery = relay.post_comment(
        DISCUSSION_ID,
        "comment-1",
        alice_laptop.epoch().as_u64(),
        alice_laptop.device_id(),
        ciphertext.clone(),
    );
    assert_eq!(
        comment_delivery.events,
        vec![RelayEvent::CommentPosted {
            discussion_id: DISCUSSION_ID.into(),
            comment_id: "comment-1".into(),
            epoch: alice_laptop.epoch().as_u64(),
        }]
    );

    let RelayEnvelope::Comment {
        ciphertext: relayed_ciphertext,
        ..
    } = comment_delivery.envelope
    else {
        panic!("expected comment envelope");
    };

    // Bob decrypts the relayed ciphertext on another client.
    let decrypted = bob
        .decrypt_comment(&relayed_ciphertext)
        .expect("bob decrypts relayed comment");
    assert_eq!(decrypted.sender_user_id, "alice");
    assert_eq!(decrypted.sender_device_id, "laptop");
    assert_eq!(decrypted.body, comment_body);

    // Alice removes Bob; remaining members process the remove commit from relay.
    let bob_leaf = bob.own_leaf_index();
    let remove_commit = alice_laptop
        .remove_member(bob_leaf)
        .expect("alice removes bob");
    relay.post_commit(
        DISCUSSION_ID,
        alice_laptop.epoch().as_u64(),
        remove_commit.clone(),
    );
    alice_phone
        .process_commit(&remove_commit)
        .expect("alice phone processes remove commit");

    bob.process_commit(&remove_commit)
        .expect("bob processes remove commit and becomes inactive");

    assert!(!bob.is_active(), "removed member group should be inactive");
    assert!(
        bob.encrypt_comment(b"should not encrypt").is_err(),
        "removed member must not encrypt new comments"
    );

    // Future comments must not decrypt for the removed member.
    let post_remove_ciphertext = alice_laptop
        .encrypt_comment(b"Follow-up after removal")
        .expect("post-removal encrypt");
    relay.post_comment(
        DISCUSSION_ID,
        "comment-2",
        alice_laptop.epoch().as_u64(),
        alice_laptop.device_id(),
        post_remove_ciphertext.clone(),
    );

    let decrypt_result = bob.decrypt_comment(&post_remove_ciphertext);
    assert!(
        decrypt_result.is_err(),
        "removed member must not decrypt future comments"
    );

    // Remaining authorized device still decrypts successfully.
    let still_member = alice_phone
        .decrypt_comment(&post_remove_ciphertext)
        .expect("remaining member decrypts post-removal comment");
    assert_eq!(still_member.body, b"Follow-up after removal");

    // Relay snapshot proves only ciphertext/control payloads were stored.
    assert_eq!(relay.list_commits(DISCUSSION_ID).len(), 3);
    assert_eq!(relay.list_welcomes(DISCUSSION_ID).len(), 2);
    assert_eq!(relay.list_comments(DISCUSSION_ID).len(), 2);
}
