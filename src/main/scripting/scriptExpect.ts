import { config, expect, use as chaiUse } from 'chai';
import { installCallablePropertyCompat } from '#/main/scripting/scriptAssertionCompat';
import { installResponseAssertions } from '#/main/scripting/scriptResponseAssertions';

/**
 * Chai BDD `expect` factory endowment for `hc.expect` in script sandboxes.
 *
 * This module must load before SES `lockdown()` in the utility-process script
 * runner so Chai can initialize against unhardened intrinsics.
 */
config.truncateThreshold = 0;
chaiUse(installResponseAssertions);
chaiUse(installCallablePropertyCompat);

export { expect as scriptExpect };
