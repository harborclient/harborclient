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
      className="w-80"
      labelledBy="about-modal-title"
      title="HarborClient"
    >
      <div className="flex flex-col items-center text-center">
        <img src={logoUrl} alt="HarborClient" className="mb-4 h-26 w-40" />
        {about.version && <p className="m-0 text-[14px] text-muted">Version {about.version}</p>}
        <nav aria-label="Social links" className="mt-4 flex items-center gap-2">
          {SOCIAL_LINKS.map(({ href, label, icon }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={label}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-selection hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <FaIcon icon={icon} className="h-5 w-5" />
            </a>
          ))}
        </nav>
      </div>
    </Modal>
  );
}
