import { config, library } from '@fortawesome/fontawesome-svg-core';
import {
  faBars,
  faChevronDown,
  faChevronRight,
  faPlus,
  faTableColumns,
  faXmark
} from '@fortawesome/free-solid-svg-icons';

library.add(faXmark, faPlus, faBars, faTableColumns, faChevronDown, faChevronRight);
config.autoAddCss = false;

export { faBars, faChevronDown, faChevronRight, faPlus, faTableColumns, faXmark };
