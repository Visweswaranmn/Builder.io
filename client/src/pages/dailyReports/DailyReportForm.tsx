import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import { TextField, TextareaField, SelectField } from '@/components/ui/FormField';
import * as dailyReportsApi from '@/lib/api/dailyReports';
import * as projectsApi from '@/lib/api/projects';
import type { Project } from '@/types/models';

export default function DailyReportForm() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);

  const [form, setForm] = useState({
    project: '',
    date: new Date().toISOString().slice(0, 10),
    workDone: '',
    progressPercentage: '',
    laborCount: '',
    weather: '',
  });

  useEffect(() => {
    projectsApi.listProjects({ limit: 100 }).then((r) => setProjects(r.projects)).catch(() => {});
  }, []);

  function handleImagesChange(e: ChangeEvent<HTMLInputElement>) {
    setImages(e.target.files ? Array.from(e.target.files) : []);
  }

  function handleVideosChange(e: ChangeEvent<HTMLInputElement>) {
    setVideos(e.target.files ? Array.from(e.target.files) : []);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const created = await dailyReportsApi.createDailyReport(
        {
          project: form.project,
          date: form.date || undefined,
          workDone: form.workDone || undefined,
          progressPercentage: form.progressPercentage ? Number(form.progressPercentage) : undefined,
          laborCount: form.laborCount ? Number(form.laborCount) : undefined,
          weather: form.weather || undefined,
        },
        images,
        videos,
      );
      navigate(`/daily-reports/${created._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit daily report');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="New Daily Report" />

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-panel p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Project"
            required
            placeholder="Select a project"
            options={projects.map((p) => ({ value: p._id, label: p.name }))}
            value={form.project}
            onChange={(e) => setForm({ ...form, project: e.target.value })}
          />
          <TextField label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>

        <TextareaField label="Work Done" value={form.workDone} onChange={(e) => setForm({ ...form, workDone: e.target.value })} />

        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Progress %"
            type="number"
            min={0}
            max={100}
            value={form.progressPercentage}
            onChange={(e) => setForm({ ...form, progressPercentage: e.target.value })}
          />
          <TextField label="Labor Count" type="number" min={0} value={form.laborCount} onChange={(e) => setForm({ ...form, laborCount: e.target.value })} />
          <TextField label="Weather" value={form.weather} onChange={(e) => setForm({ ...form, weather: e.target.value })} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-ink">Photos</label>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImagesChange} className="mt-1 block w-full text-sm text-ink-muted" />
            {images.length > 0 && <p className="mt-1 text-xs text-ink-faint">{images.length} photo(s) selected</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-ink">Videos</label>
            <input type="file" accept="video/mp4,video/quicktime,video/webm" multiple onChange={handleVideosChange} className="mt-1 block w-full text-sm text-ink-muted" />
            {videos.length > 0 && <p className="mt-1 text-xs text-ink-faint">{videos.length} video(s) selected</p>}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/daily-reports')}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Report'}
          </Button>
        </div>
      </form>
    </div>
  );
}
