import { type JSX } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectActiveBrowserTab } from '#/renderer/src/store/selectors';
import { AboutModal } from '#/renderer/src/ui/Modals/AboutModal';
import { SyncModal } from '#/renderer/src/ui/Modals/SyncModal';
import { UpdateModal } from '#/renderer/src/ui/Modals/UpdateModal';
import { AlertModal } from '#/renderer/src/ui/Modals/AlertModal';
import { AddLivePageModal } from '#/renderer/src/ui/Modals/AddLivePageModal';
import { AddLiveServerModal } from '#/renderer/src/ui/Modals/AddLiveServerModal';
import { CollectionModal } from '#/renderer/src/ui/Modals/CollectionModal';
import { WorkspaceModal } from '#/renderer/src/ui/Modals/WorkspaceModal';
import { SaveWorkflowNameModal } from '#/renderer/src/ui/Modals/SaveWorkflowNameModal';
import { ConfirmModal } from '#/renderer/src/ui/Modals/ConfirmModal';
import { OpenExternalLinkModal } from '#/renderer/src/ui/Modals/OpenExternalLinkModal';
import { HostedModalOverlay } from '#/renderer/src/ui/HostedModalOverlay';
import { ShareModal } from '#/renderer/src/ui/Modals/ShareModal';
import { QuitPrompt } from '#/renderer/src/ui/Modals/QuitPrompt';
import { UnsavedLoadPrompt } from '#/renderer/src/ui/Modals/UnsavedLoadPrompt';
import { WorkflowPanel } from '#/renderer/src/ui/Footer/WorkflowPanel';
import {
  DEFAULT_TOAST_ARIA_PROPS,
  ERROR_TOAST_ARIA_PROPS,
  SUCCESS_TOAST_ARIA_PROPS
} from '#/renderer/src/ui/Shared/toastA11y';
import { ThemePickerModal } from '#/renderer/src/ui/Modals/ThemePickerModal';
import { ActionMenuModal } from '#/renderer/src/ui/Modals/ActionMenuModal';
import { TeamHubJoinDeepLinkHost } from '#/renderer/src/ui/Tabs/TeamHub/TeamHubJoinDeepLinkHost';
import { AcceptTeamHubInviteModal } from '#/renderer/src/ui/Modals/AcceptTeamHubInviteModal';

/**
 * Global modal hosts, workflow overlay, and toast container for the app shell.
 */
export function Modals(): JSX.Element {
  /**
   * When a Live Page guest is active, toasts must sit in the HTML chrome (top)
   * — WebContentsView paints above bottom-center HTML overlays.
   */
  const activeBrowserTab = useAppSelector(selectActiveBrowserTab);

  return (
    <>
      <CollectionModal />
      <AddLivePageModal />
      <AddLiveServerModal />
      <WorkspaceModal />
      <WorkflowPanel />
      <SaveWorkflowNameModal />
      <ShareModal />
      <UnsavedLoadPrompt />
      <QuitPrompt />
      <AboutModal />
      <UpdateModal />
      <SyncModal />
      <AlertModal />
      <ConfirmModal />
      <OpenExternalLinkModal />
      <ThemePickerModal />
      <ActionMenuModal />
      <HostedModalOverlay />
      <AcceptTeamHubInviteModal />
      <TeamHubJoinDeepLinkHost />
      <Toaster
        position={activeBrowserTab ? 'top-center' : 'bottom-center'}
        containerStyle={activeBrowserTab ? { top: 16 } : { bottom: 16 }}
        toastOptions={{
          duration: 2000,
          ariaProps: DEFAULT_TOAST_ARIA_PROPS,
          success: {
            ariaProps: SUCCESS_TOAST_ARIA_PROPS
          },
          error: {
            ariaProps: ERROR_TOAST_ARIA_PROPS
          },
          style: {
            background: 'var(--mac-control)',
            color: 'var(--mac-text)',
            border: '1px solid var(--mac-separator)',
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }
        }}
      />
    </>
  );
}
