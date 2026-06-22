import { config, library } from '@fortawesome/fontawesome-svg-core';
import {
  faBars,
  faChevronDown,
  faChevronRight,
  faClockRotateLeft,
  faGripVertical,
  faPlus,
  faRobot,
  faTableColumns,
  faXmark
} from '@fortawesome/free-solid-svg-icons';

library.add(
  faXmark,
  faPlus,
  faBars,
  faTableColumns,
  faChevronDown,
  faChevronRight,
  faClockRotateLeft,
  faGripVertical,
  faRobot
);
config.autoAddCss = false;

export {
  faBars,
  faChevronDown,
  faChevronRight,
  faClockRotateLeft,
  faGripVertical,
  faPlus,
  faRobot,
  faTableColumns,
  faXmark
};
