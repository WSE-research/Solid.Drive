/**
 * Semantic re-exports of Fluent UI icons for the OneDrive-inspired layout.
 * This is the only file in the codebase allowed to import from
 * `@fluentui/react-icons` directly — all other modules must import from here.
 *
 * @packageDocumentation
 */

// NOTE: keep this list lean. When a new icon is needed, add a single line
// here rather than scattering @fluentui/react-icons imports across the app
// — the ESLint rule restricts that import to this file.

export {
  HomeRegular         as HomeIcon,
  FolderRegular       as MyFilesIcon,
  PeopleRegular       as SharedIcon,
  MailInboxRegular    as RequestsIcon,
  DeleteRegular       as BinIcon,
  PersonRegular       as PeopleIcon,
  ChevronDownRegular  as ChevronDownIcon,
  AddRegular          as PlusIcon,
  SettingsRegular     as GearIcon,
  CheckmarkRegular    as CheckmarkIcon,
} from '@fluentui/react-icons';

export {
  HomeFilled       as HomeIconActive,
  FolderFilled     as MyFilesIconActive,
  PeopleFilled     as SharedIconActive,
  MailInboxFilled  as RequestsIconActive,
  DeleteFilled     as BinIconActive,
  PersonFilled     as PeopleIconActive,
} from '@fluentui/react-icons';
