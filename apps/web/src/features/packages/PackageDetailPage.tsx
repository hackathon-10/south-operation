import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ComputerRoundedIcon from '@mui/icons-material/ComputerRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import WarehouseRoundedIcon from '@mui/icons-material/WarehouseRounded';
import MoveToInboxRoundedIcon from '@mui/icons-material/MoveToInboxRounded';
import { Link, useParams } from 'react-router-dom';
import { PACKAGE_TYPE_LABEL } from '@south/shared';
import {
  useAddPackageAsset,
  useAddPackageBulkLine,
  useDeliverPackage,
  usePackage,
  useReceivePackage,
  useRemovePackageAsset,
  useRemovePackageBulkLine,
  useReopenPackage,
  useSealPackage,
  useTask,
} from '../../api/queries';
import { toUserError } from '../../api/errors';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { SoftBadge, StatusBadge } from '../../components/ui/StatusBadge';
import { ErrorState, ListSkeleton, SuccessState } from '../../components/ui/States';
import { palette, tones } from '../../theme/tokens';
import { formatDateTime, formatDestination } from '../../utils/format';
import { labels, packageTone } from '../../utils/status';
import { PackageTimeline } from './PackageTimeline';

/** מסך האריזה: תכולה, סגירה, פתיחה מחדש, קליטה ופיזור - לפי ההרשאות מהשרת. */
export function PackageDetailPage() {
  const { packageId } = useParams<{ packageId: string }>();
  const { data: pkg, isLoading, error, refetch } = usePackage(packageId);
  const { data: task } = useTask(pkg?.packingTaskId);

  const addAsset = useAddPackageAsset();
  const removeAsset = useRemovePackageAsset();
  const addBulk = useAddPackageBulkLine();
  const removeBulk = useRemovePackageBulkLine();
  const seal = useSealPackage();
  const reopen = useReopenPackage();
  const receive = useReceivePackage();
  const deliver = useDeliverPackage();

  const [assetSearch, setAssetSearch] = useState('');
  const [bulkDraft, setBulkDraft] = useState<Record<string, number>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [sealOpen, setSealOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [justSealed, setJustSealed] = useState(false);

  const remainingLines = useMemo(() => {
    if (!task) return { assets: [], bulk: [] };
    const assets = task.lines.filter(
      (line) => line.assetInstanceId && line.remainingQuantity > 0,
    );
    const bulk = task.lines.filter((line) => !line.assetInstanceId && line.remainingQuantity > 0);
    const term = assetSearch.trim().toLowerCase();
    return {
      assets: term
        ? assets.filter(
            (line) =>
              line.assetTag?.toLowerCase().includes(term) ||
              line.ownerName?.toLowerCase().includes(term),
          )
        : assets,
      bulk,
    };
  }, [task, assetSearch]);

  if (isLoading) return <ListSkeleton rows={6} />;
  if (error || !pkg) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const run = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await action();
    } catch (failure) {
      const details = toUserError(failure);
      setActionError(details.hint ? `${details.message}. ${details.hint}` : details.message);
    }
  };

  if (justSealed) {
    return (
      <Box>
        <SuccessState
          title={`אריזה ${pkg.packageNumber} נסגרה בהצלחה`}
          description={`${pkg.itemLineCount} שורות · ${pkg.totalUnits} יחידות · יעד: ${formatDestination(pkg.destination)}`}
          action={
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="center">
              <Button
                component={Link}
                to={`/packages/${pkg.id}/label`}
                variant="contained"
                size="large"
                startIcon={<PrintRoundedIcon />}
              >
                הדפסת תווית QR
              </Button>
              <Button onClick={() => setJustSealed(false)} size="large">
                חזרה לפרטי האריזה
              </Button>
              <Button component={Link} to={`/tasks/${pkg.packingTaskId}`} size="large">
                חזרה למשימה
              </Button>
            </Stack>
          }
        />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={`אריזה ${pkg.packageNumber}`}
        subtitle={`${pkg.sourceBaseName} · ${pkg.sourceRoomName} ← ${formatDestination(pkg.destination)}`}
        icon={<Inventory2RoundedIcon />}
        action={
          pkg.permissions.canSeal ? (
            <Button
              variant="contained"
              size="large"
              startIcon={<LockRoundedIcon />}
              onClick={() => setSealOpen(true)}
              fullWidth
            >
              סגירת אריזה
            </Button>
          ) : pkg.permissions.canReceive ? (
            <Button
              variant="contained"
              size="large"
              startIcon={<MoveToInboxRoundedIcon />}
              onClick={() => run(() => receive.mutateAsync({ packageId: pkg.id }))}
              fullWidth
            >
              קליטה בקריית התקשוב
            </Button>
          ) : pkg.permissions.canDeliver ? (
            <Button
              variant="contained"
              size="large"
              startIcon={<WarehouseRoundedIcon />}
              onClick={() => run(() => deliver.mutateAsync({ packageId: pkg.id }))}
              fullWidth
            >
              אישור הנחה בחדר היעד
            </Button>
          ) : undefined
        }
        secondaryAction={
          pkg.permissions.canPrintLabel ? (
            <Button
              component={Link}
              to={`/packages/${pkg.id}/label`}
              variant="outlined"
              size="large"
              startIcon={<PrintRoundedIcon />}
            >
              תווית QR
            </Button>
          ) : undefined
        }
      />

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {pkg.isLocked && (
        <Alert severity="info" icon={<LockRoundedIcon />} sx={{ mb: 2 }}>
          האריזה נעולה מרגע שהשליחות יצאה לדרך. אי אפשר לשנות תכולה או יעד.
        </Alert>
      )}

      <Card sx={{ p: 2.5, mb: 2.5 }}>
        <Stack direction="row" gap={1} sx={{ flexWrap: 'wrap', mb: 2 }}>
          <StatusBadge label={labels.package[pkg.status]} tone={packageTone[pkg.status]} />
          <Chip size="small" label={PACKAGE_TYPE_LABEL[pkg.packageType]} />
          <Chip size="small" label={`צוות: ${pkg.teamName}`} />
          <Chip size="small" label={`אחראי: ${pkg.responsibleUserName}`} />
          <Chip size="small" label={`משימה: ${pkg.taskNumber}`} component={Link} to={`/tasks/${pkg.packingTaskId}`} clickable />
          {pkg.missionNumber && (
            <Chip
              size="small"
              color="primary"
              label={`שליחות: ${pkg.missionNumber}`}
              component={Link}
              to={`/missions/${pkg.missionId}`}
              clickable
            />
          )}
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: 1.5,
          }}
        >
          <Detail label="מספר שורות" value={String(pkg.itemLineCount)} />
          <Detail label="סה״כ יחידות" value={String(pkg.totalUnits)} />
          <Detail label="נוצרה" value={formatDateTime(pkg.createdAt)} />
          <Detail label="נסגרה" value={formatDateTime(pkg.sealedAt)} />
          <Detail label="יצאה לדרך" value={formatDateTime(pkg.departedAt)} />
          <Detail label="הגיעה לחדר" value={formatDateTime(pkg.deliveredAt)} />
        </Box>

        {pkg.permissions.canReopen && (
          <Button
            startIcon={<LockOpenRoundedIcon />}
            sx={{ mt: 2 }}
            onClick={() => setReopenOpen(true)}
          >
            פתיחת אריזה מחדש
          </Button>
        )}
      </Card>

      {/* הוספת תכולה */}
      {pkg.permissions.canEditContent && task && (
        <Card sx={{ p: 2.5, mb: 2.5, borderColor: tones.primary.main }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700 }}>הוספת תכולה</Typography>
          <Typography sx={{ fontSize: 12.5, color: palette.textSecondary, mb: 2 }}>
            מוצגים רק פריטים שהוגדרו במשימה ועדיין לא נארזו
          </Typography>

          {remainingLines.assets.length === 0 && remainingLines.bulk.length === 0 ? (
            <Alert severity="success">כל הפריטים במשימה כבר נארזו. אפשר לסגור את האריזה</Alert>
          ) : (
            <Stack gap={2}>
              {remainingLines.assets.length > 0 && (
                <Box>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ sm: 'center' }}
                    gap={1}
                    sx={{ mb: 1 }}
                  >
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                      מחשבים ומסכים שנותרו
                    </Typography>
                    <TextField
                      size="small"
                      placeholder="חיפוש לפי מזהה או בעלים"
                      value={assetSearch}
                      onChange={(event) => setAssetSearch(event.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchRoundedIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ minWidth: 220 }}
                    />
                  </Stack>

                  <Stack divider={<Divider />} sx={{ maxHeight: 280, overflowY: 'auto' }}>
                    {remainingLines.assets.map((line) => (
                      <Stack
                        key={line.id}
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        gap={1}
                        sx={{ py: 1 }}
                      >
                        <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
                          <ComputerRoundedIcon sx={{ color: palette.textSecondary }} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 700 }} noWrap>
                              {line.productName}
                            </Typography>
                            <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }} noWrap>
                              מזהה {line.assetTag} · {line.ownerName}
                            </Typography>
                          </Box>
                        </Stack>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<AddRoundedIcon />}
                          disabled={addAsset.isPending}
                          onClick={() =>
                            run(() =>
                              addAsset.mutateAsync({
                                packageId: pkg.id,
                                assetInstanceId: line.assetInstanceId!,
                              }),
                            )
                          }
                        >
                          הוספה
                        </Button>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              )}

              {remainingLines.bulk.length > 0 && (
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1 }}>
                    ציוד כמותי שנותר
                  </Typography>
                  <Stack divider={<Divider />}>
                    {remainingLines.bulk.map((line) => {
                      const draft = bulkDraft[line.productCatalogItemId] ?? line.remainingQuantity;
                      return (
                        <Stack
                          key={line.id}
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          gap={1}
                          sx={{ py: 1 }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 700 }} noWrap>
                              {line.productName}
                            </Typography>
                            <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
                              מק״ט {line.sku} · נותרו {line.remainingQuantity}
                            </Typography>
                          </Box>
                          <Stack direction="row" alignItems="center" gap={1}>
                            <TextField
                              type="number"
                              size="small"
                              value={draft}
                              onChange={(event) =>
                                setBulkDraft((current) => ({
                                  ...current,
                                  [line.productCatalogItemId]: Math.max(
                                    1,
                                    Math.min(line.remainingQuantity, Number(event.target.value) || 1),
                                  ),
                                }))
                              }
                              inputProps={{
                                min: 1,
                                max: line.remainingQuantity,
                                style: { width: 64 },
                                'aria-label': `כמות עבור ${line.productName}`,
                              }}
                            />
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<AddRoundedIcon />}
                              disabled={addBulk.isPending}
                              onClick={() =>
                                run(() =>
                                  addBulk.mutateAsync({
                                    packageId: pkg.id,
                                    productCatalogItemId: line.productCatalogItemId,
                                    quantity: draft,
                                  }),
                                )
                              }
                            >
                              הוספה
                            </Button>
                          </Stack>
                        </Stack>
                      );
                    })}
                  </Stack>
                </Box>
              )}
            </Stack>
          )}
        </Card>
      )}

      {/* תכולת האריזה */}
      <Card sx={{ p: 2.5, mb: 2.5 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1.5 }}>
          תכולת האריזה ({pkg.totalUnits} יחידות)
        </Typography>

        {pkg.assets.length === 0 && pkg.bulkLines.length === 0 ? (
          <Typography sx={{ fontSize: 13.5, color: palette.textSecondary, py: 2 }}>
            האריזה עדיין ריקה
          </Typography>
        ) : (
          <Stack divider={<Divider />}>
            {pkg.assets.map((asset) => (
              <Stack
                key={asset.id}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                sx={{ py: 1.25 }}
              >
                <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
                  <ComputerRoundedIcon sx={{ color: palette.textSecondary }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }} noWrap>
                      {asset.productName}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }} noWrap>
                      מזהה {asset.assetTag} · בעלים: {asset.ownerName} · מק״ט {asset.sku}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" alignItems="center" gap={1}>
                  <SoftBadge label="פריט ייחודי" tone="violet" />
                  {pkg.permissions.canEditContent && (
                    <IconButton
                      aria-label={`הסרת ${asset.assetTag}`}
                      onClick={() =>
                        run(() =>
                          removeAsset.mutateAsync({
                            packageId: pkg.id,
                            assetId: asset.assetInstanceId,
                          }),
                        )
                      }
                    >
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              </Stack>
            ))}

            {pkg.bulkLines.map((line) => (
              <Stack
                key={line.id}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                sx={{ py: 1.25 }}
              >
                <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
                  <Inventory2RoundedIcon sx={{ color: palette.textSecondary }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }} noWrap>
                      {line.productName}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
                      מק״ט {line.sku}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Chip size="small" label={`${line.quantity} ${line.unitOfMeasure}`} />
                  {pkg.permissions.canEditContent && (
                    <IconButton
                      aria-label={`הסרת ${line.productName}`}
                      onClick={() =>
                        run(() => removeBulk.mutateAsync({ packageId: pkg.id, lineId: line.id }))
                      }
                    >
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </Card>

      <PackageTimeline events={pkg.timeline} />

      <ConfirmDialog
        open={sealOpen}
        title="סגירת האריזה"
        description="לאחר הסגירה האריזה עוברת לבדיקת תקינות ומוכנה לשילוח. אפשר יהיה לפתוח אותה מחדש כל עוד השליחות לא יצאה."
        confirmLabel="סגירה"
        loading={seal.isPending}
        onClose={() => setSealOpen(false)}
        onConfirm={() =>
          run(async () => {
            await seal.mutateAsync(pkg.id);
            setSealOpen(false);
            setJustSealed(true);
          })
        }
      />

      <ConfirmDialog
        open={reopenOpen}
        title="פתיחת האריזה מחדש"
        description="הפתיחה מחזירה את האריזה למצב פתוח ומאפשרת לשנות תכולה. הפעולה נרשמת ביומן."
        confirmLabel="פתיחה מחדש"
        loading={reopen.isPending}
        onClose={() => setReopenOpen(false)}
        onConfirm={() =>
          run(async () => {
            await reopen.mutateAsync({ packageId: pkg.id });
            setReopenOpen(false);
          })
        }
      />
    </Box>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: palette.textSecondary }}>{label}</Typography>
      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}
