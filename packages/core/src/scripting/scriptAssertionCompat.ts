/// <reference types="chai" />

/**
 * No-op returned after a property assertion runs so `.to.be.ok()` does not throw.
 *
 * @returns Undefined; the assertion already ran when the property was accessed.
 */
function callablePropertyNoop(): undefined {
  return undefined;
}

/**
 * Wraps a Chai property getter so the assertion runs on access and optional `()` call succeeds.
 *
 * Chai BDD registers matchers like `.to.be.ok` as property getters, not methods. Users and
 * generated scripts often append parentheses anyway; returning a no-op function after the
 * assertion keeps both `.to.be.ok` and `.to.be.ok()` working.
 *
 * @param getter - Original property getter that performs the assertion.
 * @returns Wrapped getter that runs the assertion then returns a callable no-op.
 */
export function wrapCallablePropertyGetter(
  getter: (this: Chai.AssertionStatic) => void
): (this: Chai.AssertionStatic) => () => void {
  return function wrappedPropertyGetter(this: Chai.AssertionStatic) {
    getter.call(this);
    return callablePropertyNoop;
  };
}

/**
 * Standard Chai BDD property assertions users often invoke with trailing parentheses.
 */
const CALLABLE_COMPAT_PROPERTIES = [
  'ok',
  'true',
  'false',
  'null',
  'undefined',
  'exist',
  'empty',
  'NaN',
  'finite'
] as const;

/**
 * Makes common Chai property assertions accept optional call syntax (`.to.be.ok()`).
 *
 * Must run after {@link installResponseAssertions} so response-specific `ok` semantics are
 * preserved when wrapping the overwritten getter.
 *
 * @param chai - Chai module instance from the script sandbox host.
 */
export function installCallablePropertyCompat(chai: Chai.ChaiStatic): void {
  const { Assertion } = chai;

  for (const name of CALLABLE_COMPAT_PROPERTIES) {
    Assertion.overwriteProperty(name, function callablePropertyCompat(superFn) {
      return wrapCallablePropertyGetter(function (this: Chai.AssertionStatic) {
        superFn.call(this);
      });
    });
  }
}
