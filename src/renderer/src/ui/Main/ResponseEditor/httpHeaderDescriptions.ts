/**
 * Fallback tooltip text when a header name is not in the dictionary.
 */
export const UNKNOWN_HEADER_DESCRIPTION = 'No description available.';

/**
 * Short descriptions for common HTTP headers, keyed by lowercase header name.
 */
export const HTTP_HEADER_DESCRIPTIONS: Record<string, string> = {
  'accept': 'Advertises which media types the client can process in a response.',
  'accept-ch': 'Asks the user agent to include specific client hint headers in later requests.',
  'accept-encoding': 'Lists content codings the client supports, such as gzip, br, or deflate.',
  'accept-language': 'Indicates the natural languages the client prefers for response content.',
  'accept-patch': 'States which patch document formats the client supports.',
  'accept-post': 'States which POST body formats the client supports.',
  'accept-ranges': 'Tells clients which byte-range units the server can serve.',
  'age': 'Reports how long the response has been cached, in seconds.',
  'allow': 'Lists HTTP methods supported on the target resource.',
  'authorization': 'Carries credentials used to authenticate the client with the server.',
  'cache-control':
    'Directs caches and clients how long a response may be stored and when it must be revalidated.',
  'connection': 'Controls whether the network connection stays open after the current transaction.',
  'content-disposition':
    'Hints how the response body should be presented, such as inline display or as a download.',
  'content-encoding':
    'Identifies any compression or transfer encoding applied to the response body.',
  'content-language': 'Describes the natural language(s) used in the response body.',
  'content-length': 'Gives the size of the response body in bytes.',
  'content-location': 'Provides the URI of a resource that matches the response payload.',
  'content-range':
    'Describes which portion of a larger resource is included in a partial response.',
  'content-security-policy':
    'Restricts which sources the browser may load for scripts, styles, images, and other subresources.',
  'content-security-policy-report-only':
    'Reports Content Security Policy violations without enforcing the policy.',
  'content-type': 'States the media type and optional parameters of the response body.',
  'cookie': 'Sends stored cookies from the client to the server for the request URI.',
  'date': 'Records when the origin server generated the response.',
  'dnt': 'Signals the user’s Do Not Track preference to the server.',
  'etag': 'Provides a validator for conditional requests and cache revalidation.',
  'expect': 'Declares behaviors the client requires before sending the request body.',
  'expires': 'Gives a date/time after which the response should be treated as stale.',
  'forwarded': 'Carries proxy-specific client connection information through intermediaries.',
  'from': 'Optionally identifies the human user agent controlling the client.',
  'host': 'Names the authority component of the request target URI.',
  'if-match': 'Makes the request conditional on the resource matching one of the listed ETags.',
  'if-modified-since':
    'Makes the request conditional on the resource having changed since the given date.',
  'if-none-match': 'Makes the request conditional on the resource not matching any listed ETag.',
  'if-range': 'Combines range requests with validators so stale ranges are not returned.',
  'if-unmodified-since':
    'Makes the request conditional on the resource not having changed since the given date.',
  'keep-alive': 'Parameters for managing a persistent connection across multiple requests.',
  'last-modified': 'Records when the origin server last modified the representation.',
  'link': 'Connects the response to related resources using RFC 5988 link relations.',
  'location': 'Redirects the client to a different URI for follow-up requests.',
  'max-forwards': 'Limits the number of times a TRACE or OPTIONS request may be forwarded.',
  'origin': 'States the origin that initiated the cross-origin request.',
  'pragma': 'Legacy cache directive retained for backward compatibility with HTTP/1.0 caches.',
  'proxy-authenticate': 'Challenges a client to authenticate with an intermediary proxy.',
  'proxy-authorization': 'Carries credentials for authenticating with an intermediary proxy.',
  'range': 'Requests a specific byte range of the resource instead of the full body.',
  'referer': 'Identifies the address of the page that linked to the requested resource.',
  'referrer-policy': 'Controls how much referrer information is included with downstream requests.',
  'retry-after': 'Tells the client how long to wait before retrying the request.',
  'server': 'Identifies the software handling requests at the origin server.',
  'server-timing': 'Communicates performance metrics about request handling for diagnostics.',
  'set-cookie': 'Instructs the client to store one or more cookies for future requests.',
  'strict-transport-security':
    'Requires future requests to use HTTPS for the site over a defined period.',
  'te': 'Advertises transfer codings the client is willing to accept in the response.',
  'trailer': 'Names header fields that will be sent after the chunked message body.',
  'transfer-encoding': 'Lists codings applied to the message body to form the payload on the wire.',
  'upgrade-insecure-requests': 'Asks the user agent to prefer secure origins for subresources.',
  'user-agent': 'Identifies the client software making the request.',
  'vary':
    'Names request headers that influenced the response so caches can store variants correctly.',
  'via': 'Reports intermediate protocols and recipients encountered while forwarding the message.',
  'warning':
    'Carries additional information about a response that may not be reflected in the status.',
  'www-authenticate': 'Challenges the client to provide credentials for accessing the resource.',
  'x-content-type-options': 'Disables MIME sniffing so the declared Content-Type is honored.',
  'x-frame-options': 'Controls whether the response may be embedded in frames on other origins.',
  'x-xss-protection': 'Legacy directive that enabled browser XSS filtering in older user agents.',
  'access-control-allow-credentials':
    'Indicates whether the response may be exposed when credentials are included.',
  'access-control-allow-headers': 'Lists request headers permitted during a cross-origin request.',
  'access-control-allow-methods': 'Lists HTTP methods permitted during a cross-origin request.',
  'access-control-allow-origin':
    'Names origins allowed to read the response in cross-origin requests.',
  'access-control-expose-headers': 'Lists response headers that cross-origin JavaScript may read.',
  'access-control-max-age': 'Caches preflight results for the given number of seconds.',
  'access-control-request-headers':
    'Names headers the browser intends to send in the actual cross-origin request.',
  'access-control-request-method':
    'Names the HTTP method the browser intends to use in the actual cross-origin request.',
  'alt-svc': 'Advertises alternative services, such as HTTP/3 endpoints, for the same origin.',
  'clear-site-data': 'Requests the user agent to clear browsing data associated with the origin.',
  'cross-origin-embedder-policy':
    'Controls whether cross-origin resources must declare support for being embedded.',
  'cross-origin-opener-policy':
    'Isolates the browsing context from cross-origin documents that lack a matching policy.',
  'cross-origin-resource-policy': 'Restricts which origins may load the response as a subresource.',
  'permissions-policy':
    'Enables or disables browser features and APIs within the document and embedded frames.',
  'report-to': 'Points the user agent to endpoints that should receive reporting data.',
  'traceparent': 'Propagates trace context for distributed tracing across services.',
  'tracestate': 'Carries vendor-specific trace data alongside traceparent.',
  'timing-allow-origin':
    'Allows listed origins to read detailed resource timing entries for cross-origin resources.'
};

/**
 * Returns a short description for an HTTP header name.
 *
 * @param headerName - Header field name as returned by the server.
 * @returns Known description or {@link UNKNOWN_HEADER_DESCRIPTION}.
 */
export function getHttpHeaderDescription(headerName: string): string {
  const normalized = headerName.trim().toLowerCase();
  return HTTP_HEADER_DESCRIPTIONS[normalized] ?? UNKNOWN_HEADER_DESCRIPTION;
}
