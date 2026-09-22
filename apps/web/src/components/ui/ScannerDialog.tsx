import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import KeyboardRoundedIcon from '@mui/icons-material/KeyboardRounded';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { palette, radii } from '../../theme/tokens';

interface ScannerDialogProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  /** מקבל Token מתוך ה-QR, או מספר אריזה שהוזן ידנית. */
  onResult: (result: { token?: string; packageNumber?: string }) => void;
}

/** חילוץ ה-Token מתוך ה-URL שב-QR. ה-QR מכיל רק Token אטום. */
export function extractTokenFromScan(text: string): string | null {
  const trimmed = text.trim();
  const match = /\/scan\/package\/([A-Za-z0-9_-]{20,})/.exec(trimmed);
  if (match) return match[1];
  if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * סורק QR עם מצלמת הטלפון, ותמיד עם גיבוי להזנה ידנית (§10.4, §17).
 * הרשאת מצלמה מתבקשת רק בזמן הסריקה עצמה, ולא בעליית האפליקציה.
 */
export function ScannerDialog({ open, title = 'סריקת אריזה', onClose, onResult }: ScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState('');

  useEffect(() => {
    if (!open || manualMode) return;

    let cancelled = false;
    const reader = new BrowserQRCodeReader();

    (async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current ?? undefined,
          (result) => {
            if (!result || cancelled) return;
            const token = extractTokenFromScan(result.getText());
            if (token) {
              controls.stop();
              onResult({ token });
            }
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch {
        if (!cancelled) {
          setCameraError('אין גישה למצלמה. אפשר להזין את מספר האריזה ידנית');
          setManualMode(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, manualMode, onResult]);

  useEffect(() => {
    if (!open) {
      setManualMode(false);
      setManualValue('');
      setCameraError(null);
    }
  }, [open]);

  const submitManual = () => {
    const value = manualValue.trim();
    if (!value) return;
    const token = extractTokenFromScan(value);
    onResult(token ? { token } : { packageNumber: value.toUpperCase() });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <QrCodeScannerRoundedIcon />
          <Typography sx={{ fontWeight: 800 }}>{title}</Typography>
        </Stack>
        <IconButton onClick={onClose} aria-label="סגירה">
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {!manualMode && (
          <Box
            sx={{
              position: 'relative',
              borderRadius: radii.card,
              overflow: 'hidden',
              backgroundColor: '#000',
              aspectRatio: '1 / 1',
            }}
          >
            <video
              ref={videoRef}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              muted
              playsInline
            />
            <Box
              aria-hidden="true"
              sx={{
                position: 'absolute',
                inset: '18%',
                border: '3px solid rgba(255,255,255,.9)',
                borderRadius: 2,
              }}
            />
          </Box>
        )}

        {cameraError && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {cameraError}
          </Alert>
        )}

        {!manualMode && (
          <Typography sx={{ fontSize: 13, color: palette.textSecondary, mt: 1.5, textAlign: 'center' }}>
            כוונו את המצלמה ל-QR שעל האריזה
          </Typography>
        )}

        <Divider sx={{ my: 2 }} />

        {manualMode ? (
          <Stack gap={1.5}>
            <TextField
              autoFocus
              fullWidth
              label="מספר אריזה"
              placeholder="PKG-10001"
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && submitManual()}
              inputProps={{ dir: 'ltr' }}
            />
            <Button variant="contained" size="large" onClick={submitManual} disabled={!manualValue.trim()}>
              חיפוש אריזה
            </Button>
            <Button onClick={() => setManualMode(false)} startIcon={<QrCodeScannerRoundedIcon />}>
              חזרה לסריקה
            </Button>
          </Stack>
        ) : (
          <Button
            fullWidth
            onClick={() => setManualMode(true)}
            startIcon={<KeyboardRoundedIcon />}
            sx={{ borderRadius: radii.pill }}
          >
            הזנה ידנית של מספר אריזה
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
