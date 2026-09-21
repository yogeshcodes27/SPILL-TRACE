import React from 'react';
import InvestigationWorkspace from './InvestigationWorkspace';

/**
 * Backward compatibility wrapper forwarding directly to the full-page InvestigationWorkspace
 */
export default function InvestigationConsoleModal(props) {
  if (props.isOpen === false) return null;
  return <InvestigationWorkspace {...props} />;
}
