//! Team Hub MLS prototype library.
//!
//! This crate is intentionally isolated from production Team Hub routes. It
//! models how encrypted discussion comment bodies could flow through a relay
//! server that stores ciphertext and MLS commits without ever seeing plaintext.

pub mod client;
pub mod relay;

pub use client::{DiscussionMlsClient, DeviceIdentity, ProcessedComment};
pub use relay::{FakeRelay, RelayDelivery, RelayEnvelope, RelayEvent};
