import { config, library } from '@fortawesome/fontawesome-svg-core';
import {
  faBars,
  faChevronDown,
  faChevronRight,
  faCircleCheck,
  faClockRotateLeft,
  faGripVertical,
  faMinus,
  faPlus,
  faRobot,
  faTableColumns,
  faWindowMaximize,
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
  faCircleCheck,
  faGripVertical,
  faRobot,
  faMinus,
  faWindowMaximize
);
config.autoAddCss = false;

export {
  faBars,
  faChevronDown,
  faChevronRight,
  faCircleCheck,
  faClockRotateLeft,
  faGripVertical,
  faMinus,
  faPlus,
  faRobot,
  faTableColumns,
  faWindowMaximize,
  faXmark
};
