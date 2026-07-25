import { channel } from 'node:diagnostics_channel';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestTiming } from './RequestTiming.js';

const beforeConnectChannel = channel('undici:client:beforeConnect');
const connectedChannel = channel('undici:client:connected');
const requestCreateChannel = channel('undici:request:create');
const sendHeadersChannel = channel('undici:client:sendHeaders');
const bodySentChannel = channel('undici:request:bodySent');
const responseHeadersChannel = channel('undici:request:headers');

interface FakeRequest {
  /**
   * Request origin used by undici diagnostics payloads.
   */
  origin: string;

  /**
   * HTTP method used by undici diagnostics payloads.
   */
  method: string;
}

/**
 * Builds a minimal request object matching the undici diagnostics fields we read.
 *
 * @param origin - Request origin.
 * @param method - HTTP method.
 * @returns Fake undici request object.
 */
function fakeRequest(origin: string, method = 'GET'): FakeRequest {
  return { origin, method };
}

/**
 * Publishes a beforeConnect diagnostics event.
 *
 * @param origin - Origin whose host/protocol should be represented.
 */
function publishBeforeConnect(origin: string): void {
  const url = new URL(origin);
  beforeConnectChannel.publish({
    connectParams: {
      host: url.host,
      hostname: url.hostname,
      protocol: url.protocol,
      port: url.port,
      servername: url.hostname
    }
  });
}

/**
 * Publishes a connected diagnostics event for a socket.
 *
 * @param origin - Origin whose host/protocol should be represented.
 * @param socket - Fake socket object to bridge connection timing to sendHeaders.
 */
function publishConnected(origin: string, socket: object): void {
  const url = new URL(origin);
  connectedChannel.publish({
    connectParams: {
      host: url.host,
      hostname: url.hostname,
      protocol: url.protocol,
      port: url.port,
      servername: url.hostname
    },
    socket
  });
}

describe('RequestTiming', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('captures all timing phases for a new connection', () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(1010)
      .mockReturnValueOnce(1030)
      .mockReturnValueOnce(1040)
      .mockReturnValueOnce(1045)
      .mockReturnValueOnce(1095);

    const origin = 'https://new-connection.example';
    const request = fakeRequest(origin);
    const socket = {};
    const session = new RequestTiming().start(1000, `${origin}/path`, 'GET');

    publishBeforeConnect(origin);
    publishConnected(origin, socket);
    requestCreateChannel.publish({ request });
    sendHeadersChannel.publish({ request, socket });
    bodySentChannel.publish({ request });
    responseHeadersChannel.publish({ request });
    session.stop();

    expect(session.toPhases(115)).toEqual({
      stalledMs: 10,
      connectMs: 20,
      requestSentMs: 5,
      waitingMs: 50,
      downloadMs: 20
    });
  });

  it('omits connect timing when an existing connection is reused', () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(2010)
      .mockReturnValueOnce(2014)
      .mockReturnValueOnce(2044);

    const origin = 'https://reused-connection.example';
    const request = fakeRequest(origin);
    const socket = {};
    const session = new RequestTiming().start(2000, `${origin}/path`, 'GET');

    requestCreateChannel.publish({ request });
    sendHeadersChannel.publish({ request, socket });
    bodySentChannel.publish({ request });
    responseHeadersChannel.publish({ request });
    session.stop();

    expect(session.toPhases(60)).toEqual({
      stalledMs: 10,
      requestSentMs: 4,
      waitingMs: 30,
      downloadMs: 16
    });
  });

  it('returns undefined when request bytes were never written', () => {
    const origin = 'https://no-send.example';
    const request = fakeRequest(origin);
    const session = new RequestTiming().start(3000, `${origin}/path`, 'GET');

    requestCreateChannel.publish({ request });
    session.stop();

    expect(session.toPhases(1)).toBeUndefined();
  });

  it('ignores diagnostics for unrelated origins', () => {
    vi.spyOn(performance, 'now').mockReturnValue(4010);

    const request = fakeRequest('https://other-origin.example');
    const session = new RequestTiming().start(4000, 'https://target-origin.example/path', 'GET');

    requestCreateChannel.publish({ request });
    sendHeadersChannel.publish({ request, socket: {} });
    bodySentChannel.publish({ request });
    responseHeadersChannel.publish({ request });
    session.stop();

    expect(session.toPhases(20)).toBeUndefined();
  });
});
