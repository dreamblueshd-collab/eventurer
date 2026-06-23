-- Migration 042: (Reverted) - No longer needed
-- All datetime columns now use local server time (GETDATE) consistently.
-- This migration was previously applied and then reverted.
-- Keeping file as placeholder to prevent re-running.

USE CSI;
GO

PRINT 'Migration 042: No action needed (reverted to GETDATE)';
GO
