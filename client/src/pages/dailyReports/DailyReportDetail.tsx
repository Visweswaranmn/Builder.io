import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import RoleGate from '@/components/RoleGate';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { SelectField, TextField } from '@/components/ui/FormField';
import { statusTone } from '@/lib/statusTone';
import * as dailyReportsApi from '@/lib/api/dailyReports';
import type { DailyReport, Issue } from '@/types/models';

export default function DailyReportDetail() {
  const { id } = useParams();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [issueDescription, setIssueDescription] = useState('');
  const [issueSeverity, setIssueSeverity] = useState<Issue['severity']>('medium');
  const [submittingIssue, setSubmittingIssue] = useState(false);

  const [newImages, setNewImages] = useState<File[]>([]);
  const [newVideos, setNewVideos] = useState<File[]>([]);
  const [submittingMedia, setSubmittingMedia] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      setReport(await dailyReportsApi.getDailyReport(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load daily report');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAddIssue(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSubmittingIssue(true);
    setError('');
    try {
      await dailyReportsApi.addIssue(id, { description: issueDescription, severity: issueSeverity });
      setIssueDescription('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log issue');
    } finally {
      setSubmittingIssue(false);
    }
  }

  async function handleToggleResolved(index: number, resolved: boolean) {
    if (!id) return;
    setError('');
    try {
      await dailyReportsApi.updateIssue(id, index, { resolved });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update issue');
    }
  }

  async function handleAddMedia(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSubmittingMedia(true);
    setError('');
    try {
      await dailyReportsApi.addMedia(id, newImages, newVideos);
      setNewImages([]);
      setNewVideos([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload media');
    } finally {
      setSubmittingMedia(false);
    }
  }

  if (loading) return <Spinner />;
  if (!report) return <p className="text-sm text-red-600">{error || 'Report not found'}</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={`Daily Report — ${new Date(report.date).toLocaleDateString()}`}
        description={`${report.project?.name ?? ''} · Filed by ${report.engineer?.name ?? ''}`}
      />

      <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-panel p-5 sm:grid-cols-4">
        <div>
          <p className="text-xs text-ink-faint">Progress</p>
          <p className="text-ink">{report.progressPercentage}%</p>
        </div>
        <div>
          <p className="text-xs text-ink-faint">Labor Count</p>
          <p className="text-ink">{report.laborCount}</p>
        </div>
        <div>
          <p className="text-xs text-ink-faint">Weather</p>
          <p className="text-ink">{report.weather ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-ink-faint">Work Done</p>
          <p className="text-ink">{report.workDone || '—'}</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">Photos</h2>
        {report.images.length === 0 ? (
          <p className="text-sm text-ink-faint">No photos uploaded.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {report.images.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt="Site progress" className="h-24 w-full rounded-md border border-slate-200 object-cover" />
              </a>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">Videos</h2>
        {report.videos.length === 0 ? (
          <p className="text-sm text-ink-faint">No videos uploaded.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {report.videos.map((url) => (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video key={url} src={url} controls className="w-full rounded-md border border-slate-200" />
            ))}
          </div>
        )}
      </div>

      <RoleGate roles={['super_admin', 'project_manager', 'site_engineer']}>
        <form onSubmit={handleAddMedia} className="rounded-lg border border-slate-200 bg-panel p-5">
          <h2 className="text-sm font-semibold text-ink">Add More Media</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-ink">Photos</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewImages(e.target.files ? Array.from(e.target.files) : [])}
                className="mt-1 block w-full text-sm text-ink-muted"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink">Videos</label>
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                multiple
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewVideos(e.target.files ? Array.from(e.target.files) : [])}
                className="mt-1 block w-full text-sm text-ink-muted"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button type="submit" disabled={submittingMedia || (newImages.length === 0 && newVideos.length === 0)}>
              {submittingMedia ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </form>
      </RoleGate>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">Issues</h2>
        <RoleGate roles={['super_admin', 'project_manager', 'site_engineer']}>
          <form onSubmit={handleAddIssue} className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-panel p-4">
            <div className="w-64">
              <TextField label="Description" required value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} />
            </div>
            <div className="w-40">
              <SelectField
                label="Severity"
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]}
                value={issueSeverity}
                onChange={(e) => setIssueSeverity(e.target.value as Issue['severity'])}
              />
            </div>
            <Button type="submit" disabled={submittingIssue}>
              {submittingIssue ? 'Saving…' : 'Log Issue'}
            </Button>
          </form>
        </RoleGate>

        {report.issues.length === 0 ? (
          <p className="text-sm text-ink-faint">No issues logged.</p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-panel">
            {report.issues.map((issue, index) => (
              <div key={index} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone(issue.severity)}>{issue.severity}</Badge>
                    {issue.resolved ? <Badge tone="green">resolved</Badge> : <Badge tone="amber">open</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-ink">{issue.description}</p>
                </div>
                <RoleGate roles={['super_admin', 'project_manager', 'site_engineer']}>
                  <button
                    onClick={() => handleToggleResolved(index, !issue.resolved)}
                    className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    {issue.resolved ? 'Reopen' : 'Resolve'}
                  </button>
                </RoleGate>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
