import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ThemeProvider } from './lib/theme';
import { AuthProvider, useAuth } from './lib/auth';

const VideoCompositionBuilder = lazy(() => import('./components/video-builder/VideoCompositionBuilder'));
const VideoPreview = lazy(() => import('./components/VideoPreview').then(m => ({ default: m.VideoPreview })));
const DocStudioIndex = lazy(() => import('./components/doc-studio/DocStudioIndex').then(m => ({ default: m.DocStudioIndex })));
const DocStudioDraftDetail = lazy(() => import('./components/doc-studio/DocStudioDraftDetail').then(m => ({ default: m.DocStudioDraftDetail })));
const DocStudioSettings = lazy(() => import('./components/doc-studio/DocStudioSettings').then(m => ({ default: m.DocStudioSettings })));
const SimpleDocStudio = lazy(() => import('./components/doc-studio/SimpleDocStudio').then(m => ({ default: m.SimpleDocStudio })));
const SimpleDocStudioResult = lazy(() => import('./components/doc-studio/SimpleDocStudioResult').then(m => ({ default: m.SimpleDocStudioResult })));
const WorkflowsIndex = lazy(() => import('./components/doc-studio/WorkflowsIndex').then(m => ({ default: m.WorkflowsIndex })));
const WorkflowEditor = lazy(() => import('./components/doc-studio/WorkflowEditor').then(m => ({ default: m.WorkflowEditor })));
const JobsIndex = lazy(() => import('./components/doc-studio/JobsIndex').then(m => ({ default: m.JobsIndex })));
const JobDetail = lazy(() => import('./components/doc-studio/JobDetail').then(m => ({ default: m.JobDetail })));
const ReviewDashboardPage = lazy(() => import('./components/doc-studio/ReviewDashboardPage').then(m => ({ default: m.ReviewDashboardPage })));
const IntegrityQueueIndex = lazy(() => import('./components/doc-studio/IntegrityQueueIndex').then(m => ({ default: m.IntegrityQueueIndex })));
const RevalidationQueuePage = lazy(() => import('./components/doc-studio/RevalidationQueuePage').then(m => ({ default: m.RevalidationQueuePage })));

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-navy-900">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

function DocStudioIndexRoute() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  return (
    <DocStudioIndex
      organizationId={profile?.organization_id}
      onOpenDraft={(id) => navigate(`/drafts/${id}`)}
      onGenerateWithAI={() => navigate('/simple')}
    />
  );
}

function DocStudioDraftDetailRoute() {
  const { draftId } = useParams<{ draftId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  return (
    <DocStudioDraftDetail
      draftId={draftId ?? null}
      organizationId={profile?.organization_id ?? ''}
      onBack={() => navigate('/')}
    />
  );
}

function SimpleDocStudioRoute() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  return (
    <SimpleDocStudio
      organizationId={profile?.organization_id}
      onDone={(draftId) => navigate(`/simple/result?draftId=${draftId}`)}
      onBack={() => navigate('/')}
    />
  );
}

function SimpleDocStudioResultRoute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get('draftId') ?? '';
  return (
    <SimpleDocStudioResult
      draftId={draftId}
      onBack={() => navigate('/simple')}
      onAdvancedEdit={(id) => navigate(`/drafts/${id}`)}
    />
  );
}

function WorkflowsIndexRoute() {
  const navigate = useNavigate();
  return (
    <WorkflowsIndex
      onEditWorkflow={(id) => navigate(`/workflows/${id}`)}
      onViewJob={(id) => navigate(`/jobs/${id}`)}
    />
  );
}

function WorkflowEditorRoute() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();
  return (
    <WorkflowEditor
      workflowId={workflowId ?? null}
      onBack={() => navigate('/workflows')}
    />
  );
}

function JobsIndexRoute() {
  const navigate = useNavigate();
  return <JobsIndex onViewJob={(id) => navigate(`/jobs/${id}`)} />;
}

function JobDetailRoute() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  return (
    <JobDetail
      jobId={jobId ?? ''}
      onBack={() => navigate('/jobs')}
      onOpenDraft={(draftId) => navigate(`/drafts/${draftId}`)}
    />
  );
}

function ReviewDashboardRoute() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  return (
    <ReviewDashboardPage
      organizationId={profile?.organization_id ?? ''}
      onNavigateToDraft={(id) => navigate(`/drafts/${id}`)}
    />
  );
}

function AppContent() {
  return (
    <Routes>
      <Route path="/" element={
        <ProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <DocStudioIndexRoute />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/drafts/:draftId" element={
        <ProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <DocStudioDraftDetailRoute />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/simple" element={
        <ProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <SimpleDocStudioRoute />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/simple/result" element={
        <ProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <SimpleDocStudioResultRoute />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/workflows" element={
        <ProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <WorkflowsIndexRoute />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/workflows/:workflowId" element={
        <ProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <WorkflowEditorRoute />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/jobs" element={
        <ProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <JobsIndexRoute />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/jobs/:jobId" element={
        <ProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <JobDetailRoute />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/reviews" element={
        <ProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <ReviewDashboardRoute />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/integrity" element={
        <ProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <IntegrityQueueIndex />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/revalidation" element={
        <ProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <RevalidationQueuePage />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <DocStudioSettings />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/login" element={
        <div className="flex items-center justify-center min-h-screen bg-navy-900">
          <div className="text-center text-white">
            <h1 className="text-2xl font-bold mb-2">Documentation Studio</h1>
            <p className="text-slate-400">Please sign in via your Supabase project to access the studio.</p>
          </div>
        </div>
      } />
            <Route path="/video-builder" element={
        <ProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}>
            <VideoCompositionBuilder />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/video-preview" element={
        <Suspense fallback={<LoadingSpinner />}>
          <VideoPreview />
        </Suspense>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
