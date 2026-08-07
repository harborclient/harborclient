//! In-memory fake REST/SSE relay for the MLS prototype.
//!
//! The relay stores only ciphertext and MLS control messages. It never attempts
//! to decrypt discussion bodies, mirroring the intended Team Hub server role in
//! an E2EE-enabled hub.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

/// Payload kinds exchanged through the fake relay.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RelayEnvelope {
    /// MLS commit delivered to existing members (`POST /discussion-mls/commits`).
    Commit {
        discussion_id: String,
        epoch: u64,
        ciphertext: Vec<u8>,
    },
    /// Welcome delivered to a newly added device (`POST /discussion-mls/welcomes`).
    Welcome {
        discussion_id: String,
        recipient_device_id: String,
        ciphertext: Vec<u8>,
        ratchet_tree: Vec<u8>,
    },
    /// Encrypted discussion comment body (`POST /discussions/:id/comments`).
    Comment {
        discussion_id: String,
        comment_id: String,
        epoch: u64,
        sender_device_id: String,
        ciphertext: Vec<u8>,
    },
}

/// SSE-style event emitted after relay writes.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RelayEvent {
    CommitPosted {
        discussion_id: String,
        epoch: u64,
    },
    WelcomePosted {
        discussion_id: String,
        recipient_device_id: String,
    },
    CommentPosted {
        discussion_id: String,
        comment_id: String,
        epoch: u64,
    },
}

/// Delivery bundle returned to prototype clients after a relay write.
#[derive(Debug, Clone)]
pub struct RelayDelivery {
    pub envelope: RelayEnvelope,
    pub events: Vec<RelayEvent>,
}

/// Errors returned by the fake relay store.
#[derive(Debug, Error, PartialEq, Eq)]
pub enum RelayError {
    #[error("discussion not found: {0}")]
    UnknownDiscussion(String),
}

/**
 * Minimal in-memory relay modeling REST persistence plus SSE fan-out hints.
 */
#[derive(Debug, Default)]
pub struct FakeRelay {
    commits: HashMap<String, Vec<RelayEnvelope>>,
    welcomes: HashMap<String, Vec<RelayEnvelope>>,
    comments: HashMap<String, Vec<RelayEnvelope>>,
    events: Vec<RelayEvent>,
}

impl FakeRelay {
    /**
     * Stores an MLS commit and emits an SSE-style event for connected clients.
     */
    pub fn post_commit(
        &mut self,
        discussion_id: &str,
        epoch: u64,
        commit_bytes: Vec<u8>,
    ) -> RelayDelivery {
        let envelope = RelayEnvelope::Commit {
            discussion_id: discussion_id.to_string(),
            epoch,
            ciphertext: commit_bytes,
        };
        self.commits
            .entry(discussion_id.to_string())
            .or_default()
            .push(envelope.clone());

        let event = RelayEvent::CommitPosted {
            discussion_id: discussion_id.to_string(),
            epoch,
        };
        self.events.push(event.clone());

        RelayDelivery {
            envelope,
            events: vec![event],
        }
    }

    /**
     * Stores a welcome for a newly added device.
     */
    pub fn post_welcome(
        &mut self,
        discussion_id: &str,
        recipient_device_id: &str,
        welcome_bytes: Vec<u8>,
        ratchet_tree: Vec<u8>,
    ) -> RelayDelivery {
        let envelope = RelayEnvelope::Welcome {
            discussion_id: discussion_id.to_string(),
            recipient_device_id: recipient_device_id.to_string(),
            ciphertext: welcome_bytes,
            ratchet_tree,
        };
        self.welcomes
            .entry(discussion_id.to_string())
            .or_default()
            .push(envelope.clone());

        let event = RelayEvent::WelcomePosted {
            discussion_id: discussion_id.to_string(),
            recipient_device_id: recipient_device_id.to_string(),
        };
        self.events.push(event.clone());

        RelayDelivery {
            envelope,
            events: vec![event],
        }
    }

    /**
     * Stores an encrypted discussion comment body.
     */
    pub fn post_comment(
        &mut self,
        discussion_id: &str,
        comment_id: &str,
        epoch: u64,
        sender_device_id: &str,
        ciphertext: Vec<u8>,
    ) -> RelayDelivery {
        let envelope = RelayEnvelope::Comment {
            discussion_id: discussion_id.to_string(),
            comment_id: comment_id.to_string(),
            epoch,
            sender_device_id: sender_device_id.to_string(),
            ciphertext,
        };
        self.comments
            .entry(discussion_id.to_string())
            .or_default()
            .push(envelope.clone());

        let event = RelayEvent::CommentPosted {
            discussion_id: discussion_id.to_string(),
            comment_id: comment_id.to_string(),
            epoch,
        };
        self.events.push(event.clone());

        RelayDelivery {
            envelope,
            events: vec![event],
        }
    }

    /** Returns all commits posted for a discussion (`GET /discussion-mls/commits`). */
    pub fn list_commits(&self, discussion_id: &str) -> Vec<&RelayEnvelope> {
        self.commits
            .get(discussion_id)
            .map(|entries| entries.iter().collect())
            .unwrap_or_default()
    }

    /** Returns all welcomes posted for a discussion. */
    pub fn list_welcomes(&self, discussion_id: &str) -> Vec<&RelayEnvelope> {
        self.welcomes
            .get(discussion_id)
            .map(|entries| entries.iter().collect())
            .unwrap_or_default()
    }

    /** Returns all encrypted comments for a discussion. */
    pub fn list_comments(&self, discussion_id: &str) -> Vec<&RelayEnvelope> {
        self.comments
            .get(discussion_id)
            .map(|entries| entries.iter().collect())
            .unwrap_or_default()
    }

    /** Returns SSE-style events emitted so far (`GET /events` snapshot). */
    pub fn drain_events(&mut self) -> Vec<RelayEvent> {
        std::mem::take(&mut self.events)
    }
}
