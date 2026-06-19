import { config, library } from '@fortawesome/fontawesome-svg-core';
import {
  faBars,
  faPlus,
  faSidebar,
  faXmark
} from '@awesome.me/kit-55c528f18b/icons/classic/solid';

library.add(faXmark, faPlus, faBars, faSidebar);
config.autoAddCss = false;

export { faBars, faPlus, faSidebar, faXmark };
