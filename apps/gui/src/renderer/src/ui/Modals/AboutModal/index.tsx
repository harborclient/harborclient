import { FaIcon, Modal } from '@harborclient/sdk/components';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { useEffect, type JSX } from 'react';
import logoUrl from '@images/logo.png';
import { faGithub, faReddit, faXTwitter } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { closeAboutModal, selectAboutModal } from '#/renderer/src/store/slices/modalsSlice';
import { fetchAppVersion } from '#/renderer/src/store/thunks';

interface SocialLink {
  /**
   * Destination opened in the system browser.
   */
  href: string;

  /**
   * Accessible name for the icon-only link.
   */
  label: string;

  /**
   * Brand icon shown in the link.
   */
  icon: IconDefinition;
}

/**
 * External community profiles linked from the About dialog.
 */
const SOCIAL_LINKS: readonly SocialLink[] = [
  {
    href: 'https://github.com/harborclient/harborclient',
    label: 'GitHub',
    icon: faGithub
  },
  {
    href: 'https://reddit.com/r/HarborClient',
    label: 'Reddit',
    icon: faReddit
  },
  {
    href: 'https://x.com/HarborClient',
    label: 'X',
    icon: faXTwitter
  }
];

/**
 * Intrinsic pixel dimensions of `images/logo.png` (used for layout and aspect ratio).
 */
const LOGO_WIDTH = 500;
const LOGO_HEIGHT = 500;

/**
 * Public marketing site opened from the About dialog logo link.
 */
const WEBSITE_URL = 'https://harborclient.com';

/**
 * About dialog showing the application name, version, and community links.
 */
export function AboutModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const about = useAppSelector(selectAboutModal);

  /**
   * Loads the application version from the main process when the dialog opens.
   */
  useEffect(() => {
    if (!about.open) return;
    void dispatch(fetchAppVersion());
  }, [about.open, dispatch]);

  if (!about.open) return null;

  return (
    <Modal
      onClose={() => dispatch(closeAboutModal())}
      className="flex aspect-video w-[min(48rem,calc(100vw-2rem))] flex-col overflow-hidden px-6 !py-11"
      label="HarborClient"
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <a
          href={WEBSITE_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="HarborClient website"
          className="mb-4 inline-block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <img
            src={logoUrl}
            alt=""
            width={LOGO_WIDTH}
            height={LOGO_HEIGHT}
            className="h-auto w-48"
          />
        </a>
        {about.version && <p className="m-0 text-[14px] text-muted">Version {about.version}</p>}
        <nav aria-label="Social links" className="mt-4 flex items-center gap-2">
          {SOCIAL_LINKS.map(({ href, label, icon }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={label}
              className="about-social-link inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-selection focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <FaIcon icon={icon} className="h-5 w-5" />
            </a>
          ))}
        </nav>
      </div>
    </Modal>
  );
}
