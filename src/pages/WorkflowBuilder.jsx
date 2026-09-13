import { useState, useMemo, useRef } from 'react';
import {
  FiZap,
  FiPlus,
  FiTrash2,
  FiArrowUp,
  FiArrowDown,
  FiSettings,
  FiPlay,
  FiDownload,
  FiRefreshCw,
  FiCheck,
  FiFileText,
  FiImage,
  FiShield,
  FiLock,
  FiCrop,
  FiHash,
  FiEdit3,
  FiArchive,
  FiX,
  FiLayers,
  FiSearch,
  FiShare2,
  FiUpload,
  FiEye,
  FiChevronLeft,
  FiChevronRight,
  FiSidebar,
} from 'react-icons/fi';
import JSZip from 'jszip';
import ToolStudioHeader from '../components/studio/ToolStudioHeader';
import UniversalPreviewModal from '../components/studio/UniversalPreviewModal';
import FileUpload from '../components/FileUpload';
import AlertBanner from '../components/AlertBanner';
import {
  WORKFLOW_ACTIONS,
  WORKFLOW_TEMPLATES,
  executeWorkflowPipeline,
} from '../utils/workflowEngine';
import { formatFileSize } from '../utils/fileUtils';

const ICON_MAP = {
  FiEdit3,
  FiHash,
  FiRefreshCw,
  FiCrop,
  FiShield,
  FiLock,
  FiZap,
  FiFileText,
  FiImage,
  FiLayers,
  FiArchive,
};

const CATEGORIES = ['All', 'PDF', 'Security', 'Optimize', 'Convert'];

export default function WorkflowBuilder() {
  // Active workflow steps [{ id, actionId, config }]
  const [steps, setSteps] = useState([
    { id: 'step-1', actionId: 'metadataScrub', config: { wipeAll: true } },
    {
      id: 'step-2',
      actionId: 'watermark',
      config: { text: 'CONFIDENTIAL', opacity: 0.2, color: '#ff4757', fontSize: 44, rotation: 45 },
    },
    { id: 'step-3', actionId: 'compressPdf', config: { level: 'balanced' } },
  ]);

  const [inputFiles, setInputFiles] = useState([]);
  const [activeTemplate, setActiveTemplate] = useState('clean-and-secure');
  const [editingStepIndex, setEditingStepIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [mobileActiveTab, setMobileActiveTab] = useState('canvas'); // 'tools' | 'canvas' | 'station'
  const [isPaletteCollapsed, setIsPaletteCollapsed] = useState(false);
  const [isStationCollapsed, setIsStationCollapsed] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState({
    currentFile: '',
    stepName: '',
    stepIdx: 0,
    totalSteps: 0,
    fileIdx: 0,
    totalFiles: 0,
  });
  const [outputResults, setOutputResults] = useState(null); // { files: [{ file, url }], zipUrl?: string }
  const [toastMessage, setToastMessage] = useState('');
  const [previewFile, setPreviewFile] = useState(null); // for UniversalPreviewModal

  const fileInputRef = useRef(null);
  const importJsonRef = useRef(null);

  // Show transient toast banner
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3500);
  };

  // Load a preset template
  const handleSelectTemplate = (templateId) => {
    const template = WORKFLOW_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setActiveTemplate(template.id);
    setSteps(
      template.steps.map((st, i) => ({
        id: `step-${Date.now()}-${i}`,
        actionId: st.actionId,
        config: { ...st.config },
      }))
    );
    setEditingStepIndex(null);
    showToast(`Loaded "${template.name}" workflow template`);
  };

  // Add action step to pipeline
  const handleAddStep = (actionId) => {
    const actionDef = WORKFLOW_ACTIONS.find((a) => a.id === actionId);
    if (!actionDef) return;

    const defaultConfig = {};
    (actionDef.configSchema || []).forEach((f) => {
      defaultConfig[f.key] = f.default;
    });

    setSteps((prev) => [
      ...prev,
      {
        id: `step-${Date.now()}`,
        actionId,
        config: defaultConfig,
      },
    ]);
    setActiveTemplate('custom');
    showToast(`Added ${actionDef.name} to pipeline`);
  };

  // Remove step
  const handleRemoveStep = (index) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
    if (editingStepIndex === index) setEditingStepIndex(null);
    setActiveTemplate('custom');
  };

  // Reorder steps
  const handleMoveStep = (index, delta) => {
    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= steps.length) return;
    setSteps((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(newIndex, 0, moved);
      return copy;
    });
    if (editingStepIndex === index) setEditingStepIndex(newIndex);
    setActiveTemplate('custom');
  };

  // Update step config
  const handleUpdateStepConfig = (key, value) => {
    if (editingStepIndex === null) return;
    setSteps((prev) => {
      const copy = [...prev];
      copy[editingStepIndex] = {
        ...copy[editingStepIndex],
        config: {
          ...copy[editingStepIndex].config,
          [key]: value,
        },
      };
      return copy;
    });
  };

  // Clear pipeline
  const handleClearPipeline = () => {
    setSteps([]);
    setEditingStepIndex(null);
    setActiveTemplate('custom');
  };

  // Export pipeline as .tfpflow JSON file
  const handleExportWorkflow = () => {
    const workflowData = {
      version: '1.0',
      title: activeTemplate !== 'custom' ? activeTemplate : 'Custom Workflow',
      exportedAt: new Date().toISOString(),
      steps: steps.map(({ actionId, config }) => ({ actionId, config })),
    };
    const blob = new Blob([JSON.stringify(workflowData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline_${Date.now()}.tfpflow`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Workflow saved as .tfpflow file');
  };

  // Import pipeline from JSON
  const handleImportWorkflow = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (Array.isArray(parsed.steps)) {
          setSteps(
            parsed.steps.map((st, i) => ({
              id: `imported-${Date.now()}-${i}`,
              actionId: st.actionId,
              config: st.config || {},
            }))
          );
          setActiveTemplate('custom');
          setEditingStepIndex(null);
          showToast(`Successfully imported ${parsed.steps.length} workflow steps!`);
        } else {
          alert('Invalid workflow file format.');
        }
      } catch (err) {
        alert('Could not parse workflow JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Input files handling
  const handleFilesSelected = (files) => {
    if (!files) return;
    const fileList = Array.from(files);
    setInputFiles((prev) => [...prev, ...fileList]);
  };

  const handleRemoveQueuedFile = (index) => {
    setInputFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearFiles = () => {
    setInputFiles([]);
    setOutputResults(null);
  };

  // Execute pipeline
  const handleRunPipeline = async () => {
    if (inputFiles.length === 0 || steps.length === 0) return;
    setIsExecuting(true);
    setOutputResults(null);

    try {
      const results = [];
      const totalFiles = inputFiles.length;

      for (let fIdx = 0; fIdx < totalFiles; fIdx++) {
        const file = inputFiles[fIdx];
        const processedFile = await executeWorkflowPipeline(
          file,
          steps,
          (stepIdx, totalSteps, stepName) => {
            setExecutionProgress({
              currentFile: file.name,
              stepName,
              stepIdx,
              totalSteps,
              fileIdx: fIdx,
              totalFiles,
            });
          }
        );
        const url = URL.createObjectURL(processedFile);
        results.push({ file: processedFile, url });
      }

      let zipUrl = null;
      if (results.length > 1) {
        const zip = new JSZip();
        results.forEach((res) => {
          zip.file(res.file.name, res.file);
        });
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        zipUrl = URL.createObjectURL(zipBlob);
      }

      setOutputResults({
        files: results,
        zipUrl,
      });
      // Switch to station tab on mobile to display outputs
      setMobileActiveTab('station');
    } catch (err) {
      console.error('Workflow execution error:', err);
      alert(`Workflow execution failed: ${err.message || err}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleResetAll = () => {
    setInputFiles([]);
    setOutputResults(null);
    setEditingStepIndex(null);
  };

  // Filter tools palette in Col 1
  const filteredActions = useMemo(() => {
    return WORKFLOW_ACTIONS.filter((action) => {
      const matchesCategory =
        selectedCategory === 'All' ||
        action.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        action.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        action.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const firstAction = steps.length > 0 ? WORKFLOW_ACTIONS.find((a) => a.id === steps[0].actionId) : null;
  const acceptMimes = useMemo(() => {
    if (!firstAction) return undefined;
    const mimes = {};
    (firstAction.acceptTypes || []).forEach((type) => {
      if (type === 'application/pdf') mimes['application/pdf'] = ['.pdf'];
      if (type.startsWith('image/')) mimes['image/*'] = ['.png', '.jpg', '.jpeg', '.webp'];
      if (type.startsWith('text/')) mimes['text/*'] = ['.txt', '.md'];
    });
    return Object.keys(mimes).length > 0 ? mimes : undefined;
  }, [firstAction]);

  return (
    <div className="studio-d-container">
      {/* 48px Compact Top Studio Header */}
      <ToolStudioHeader
        icon={FiZap}
        title="Workflow Pipeline Studio"
        toolPath="/workflow-builder"
        fileBadge={
          steps.length > 0
            ? `${steps.length} Step${steps.length !== 1 ? 's' : ''} Connected`
            : 'Empty Pipeline'
        }
        actionLabel={steps.length > 0 && inputFiles.length > 0 ? 'Run Pipeline' : undefined}
        actionIcon={FiPlay}
        onAction={handleRunPipeline}
        actionDisabled={isExecuting || steps.length === 0 || inputFiles.length === 0}
        onReset={handleResetAll}
        resetLabel="Reset All"
      >
        {/* Extra header actions */}
        <input
          type="file"
          ref={importJsonRef}
          accept=".tfpflow,.json"
          style={{ display: 'none' }}
          onChange={handleImportWorkflow}
        />
        <button
          type="button"
          onClick={() => importJsonRef.current?.click()}
          className="studio-header-action-btn"
          style={{
            background: 'var(--subtle-bg)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-color)',
          }}
          title="Import saved .tfpflow pipeline"
        >
          <FiUpload size={13} /> Import
        </button>
        <button
          type="button"
          onClick={handleExportWorkflow}
          disabled={steps.length === 0}
          className="studio-header-action-btn"
          style={{
            background: 'var(--subtle-bg)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-color)',
            opacity: steps.length === 0 ? 0.5 : 1,
          }}
          title="Export current workflow as .tfpflow"
        >
          <FiShare2 size={13} /> Export Flow
        </button>
      </ToolStudioHeader>

      {/* Toast Notification Banner if any */}
      {toastMessage && (
        <div style={{ padding: '0.4rem 1rem', flexShrink: 0 }}>
          <AlertBanner message={toastMessage} type="info" onClose={() => setToastMessage('')} />
        </div>
      )}

      {/* Responsive Mobile Segmented Navigation Tabs (<992px) */}
      <div className="studio-d-mobile-tabs">
        <button
          type="button"
          className={`studio-d-mobile-tab-btn ${mobileActiveTab === 'tools' ? 'active' : ''}`}
          onClick={() => setMobileActiveTab('tools')}
        >
          <FiPlus size={13} /> 1. Tools ({WORKFLOW_ACTIONS.length})
        </button>
        <button
          type="button"
          className={`studio-d-mobile-tab-btn ${mobileActiveTab === 'canvas' ? 'active' : ''}`}
          onClick={() => setMobileActiveTab('canvas')}
        >
          <FiLayers size={13} /> 2. Pipeline ({steps.length})
        </button>
        <button
          type="button"
          className={`studio-d-mobile-tab-btn ${mobileActiveTab === 'station' ? 'active' : ''}`}
          onClick={() => setMobileActiveTab('station')}
        >
          <FiPlay size={13} /> 3. Run & Outputs ({inputFiles.length})
        </button>
      </div>

      {/* Main 3-Column Studio Grid */}
      <div
        className="studio-d-grid"
        style={{
          gridTemplateColumns: `${isPaletteCollapsed ? '48px' : '290px'} minmax(0, 1fr) ${isStationCollapsed ? '48px' : '340px'}`,
          transition: 'grid-template-columns 0.2s ease',
        }}
      >
        {/* =========================================================
            COLUMN 1: TOOLS PALETTE DRAWER
            ========================================================= */}
        <div
          className={`studio-d-col ${mobileActiveTab === 'tools' ? 'active-mobile' : ''}`}
          style={{
            borderRight: '1px solid var(--border-color)',
            backgroundColor: 'var(--card-bg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {isPaletteCollapsed ? (
            <div
              onClick={() => setIsPaletteCollapsed(false)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '0.75rem 0.25rem',
                cursor: 'pointer',
                height: '100%',
                background: 'var(--card-bg)',
                userSelect: 'none',
              }}
              title="Click to expand Tool Palette"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaletteCollapsed(false);
                }}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--subtle-bg)',
                  color: 'var(--text-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  marginBottom: '1.25rem',
                }}
                title="Expand Tool Palette"
              >
                <FiChevronRight size={16} />
              </button>
              <span
                style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                }}
              >
                1. Tool Palette ({filteredActions.length})
              </span>
            </div>
          ) : (
            <>
              {/* Palette Top Bar */}
              <div
                style={{
                  padding: '0.85rem 1rem 0.65rem 1rem',
                  borderBottom: '1px solid var(--border-color)',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-color)' }}>
                      1. Tool Palette
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsPaletteCollapsed(true)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '3px',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                      title="Collapse Tool Palette"
                    >
                      <FiChevronLeft size={15} />
                    </button>
                  </div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-secondary)',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '12px',
                      background: 'var(--subtle-bg)',
                      fontWeight: 600,
                    }}
                  >
                    {filteredActions.length} Actions
                  </span>
                </div>

                {/* Quick Search */}
                <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                  <FiSearch
                    style={{
                      position: 'absolute',
                      left: '0.65rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                    }}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tools..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.38rem 0.65rem 0.38rem 1.9rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-color)',
                      color: 'var(--text-color)',
                      fontSize: '0.8rem',
                    }}
                  />
                </div>

                {/* Category Filter Pills */}
                <div style={{ display: 'flex', gap: '0.3rem', overflowX: 'auto', paddingBottom: '2px' }}>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      style={{
                        padding: '0.2rem 0.55rem',
                        borderRadius: '12px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        border: '1px solid',
                        borderColor:
                          selectedCategory === cat ? 'var(--primary-color)' : 'var(--border-color)',
                        background:
                          selectedCategory === cat ? 'var(--primary-color)' : 'transparent',
                        color: selectedCategory === cat ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tools List (Scrollable) */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  padding: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.55rem',
                }}
              >
                {filteredActions.map((action) => {
                  const Icon = ICON_MAP[action.icon] || FiZap;
                  return (
                    <div
                      key={action.id}
                      className="studio-d-tool-item"
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', action.id);
                      }}
                      onClick={() => handleAddStep(action.id)}
                      title="Click or drag into canvas to add to pipeline"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            backgroundColor: `${action.iconColor || '#3498db'}22`,
                            color: action.iconColor || '#3498db',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={14} />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: '0.83rem',
                                color: 'var(--text-color)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {action.name}
                            </span>
                            <span
                              style={{
                                fontSize: '0.66rem',
                                padding: '0.05rem 0.35rem',
                                borderRadius: '4px',
                                background: 'var(--subtle-bg)',
                                color: 'var(--text-secondary)',
                                fontWeight: 600,
                              }}
                            >
                              {action.category}
                            </span>
                          </div>
                          <p
                            style={{
                              fontSize: '0.74rem',
                              color: 'var(--text-secondary)',
                              margin: '0.2rem 0 0 0',
                              lineHeight: 1.25,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {action.description}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddStep(action.id);
                          }}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-color)',
                            color: 'var(--primary-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                          title="Add step"
                        >
                          <FiPlus size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* =========================================================
            COLUMN 2: DOT-GRID BLUEPRINT PIPELINE CANVAS
            ========================================================= */}
        <div
          className={`studio-d-col studio-d-canvas-grid ${mobileActiveTab === 'canvas' ? 'active-mobile' : ''
            }`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
            position: 'relative',
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const actionId = e.dataTransfer.getData('text/plain');
            if (actionId) handleAddStep(actionId);
          }}
        >
          {/* Canvas Top Controls Ribbon */}
          <div
            style={{
              padding: '0.65rem 1.25rem',
              backgroundColor: 'var(--card-bg)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            {/* Left: Presets / Template Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              {isPaletteCollapsed && (
                <button
                  type="button"
                  onClick={() => setIsPaletteCollapsed(false)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.32rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--subtle-bg)',
                    color: 'var(--text-color)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="Expand Tool Palette"
                >
                  <FiSidebar size={13} /> Tools ({filteredActions.length})
                </button>
              )}
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Blueprint:
              </span>
              <select
                value={activeTemplate}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-color)',
                  color: 'var(--text-color)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {WORKFLOW_TEMPLATES.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.steps.length} Steps)
                  </option>
                ))}
                <option value="custom">Custom Blueprint ({steps.length} Steps)</option>
              </select>
            </div>

            {/* Right Canvas Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {steps.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearPipeline}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--subtle-bg)',
                    color: '#ff4757',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <FiTrash2 size={12} /> Clear Pipeline
                </button>
              )}
              {isStationCollapsed && (
                <button
                  type="button"
                  onClick={() => setIsStationCollapsed(false)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.32rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--subtle-bg)',
                    color: 'var(--primary-color)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="Expand Run & Outputs Station"
                >
                  <FiPlay size={12} /> Run Station ({inputFiles.length})
                </button>
              )}
            </div>
          </div>

          {/* Canvas Interactive Nodes Area (Scrollable) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            {steps.length === 0 ? (
              <div
                style={{
                  margin: 'auto 0',
                  textAlign: 'center',
                  padding: '2.5rem 2rem',
                  maxWidth: '460px',
                  borderRadius: '16px',
                  border: '2px dashed var(--border-color)',
                  backgroundColor: 'var(--card-bg)',
                }}
              >
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(28, 153, 255, 0.1)',
                    color: 'var(--primary-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem auto',
                  }}
                >
                  <FiZap size={26} />
                </div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 800, fontSize: '1.1rem' }}>
                  Pipeline Canvas is Empty
                </h4>
                <p
                  style={{
                    fontSize: '0.84rem',
                    color: 'var(--text-secondary)',
                    margin: '0 0 1.25rem 0',
                    lineHeight: 1.5,
                  }}
                >
                  Select a workflow template from the top bar or click <strong>+</strong> on any
                  tool from the left palette to begin constructing your sequential pipeline.
                </p>
                <button
                  type="button"
                  onClick={() => handleSelectTemplate('clean-and-secure')}
                  className="btn-primary"
                  style={{
                    padding: '0.55rem 1.1rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                  }}
                >
                  Load "Clean & Secure PDF" Preset
                </button>
              </div>
            ) : (
              <div
                style={{
                  width: '100%',
                  maxWidth: '680px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0',
                }}
              >
                {steps.map((step, idx) => {
                  const actionDef = WORKFLOW_ACTIONS.find((a) => a.id === step.actionId) || {};
                  const Icon = ICON_MAP[actionDef.icon] || FiZap;
                  const isConfigurable = (actionDef.configSchema || []).length > 0;
                  const isEditing = editingStepIndex === idx;

                  return (
                    <div
                      key={step.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '100%',
                      }}
                    >
                      {/* Node Card */}
                      <div
                        className="studio-d-node-card"
                        style={{
                          width: '70%',
                          padding: '1rem 1.25rem',
                          borderColor: isEditing ? 'var(--primary-color)' : undefined,
                        }}
                      >
                        {/* Node Top Row: Step badge & Actions */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.65rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                background: 'rgba(28, 153, 255, 0.12)',
                                color: 'var(--primary-color)',
                              }}
                            >
                              STEP {idx + 1}
                            </span>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                background: 'var(--subtle-bg)',
                              }}
                            >
                              {actionDef.category}
                            </span>
                          </div>

                          {/* Node Reordering & Action Controls */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {idx > 0 && (
                              <button
                                type="button"
                                onClick={() => handleMoveStep(idx, -1)}
                                title="Move Step Up"
                                style={{
                                  background: 'none',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '4px',
                                  color: 'var(--text-color)',
                                  cursor: 'pointer',
                                  padding: '3px 6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <FiArrowUp size={12} />
                              </button>
                            )}
                            {idx < steps.length - 1 && (
                              <button
                                type="button"
                                onClick={() => handleMoveStep(idx, 1)}
                                title="Move Step Down"
                                style={{
                                  background: 'none',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '4px',
                                  color: 'var(--text-color)',
                                  cursor: 'pointer',
                                  padding: '3px 6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <FiArrowDown size={12} />
                              </button>
                            )}
                            {isConfigurable && (
                              <button
                                type="button"
                                onClick={() => setEditingStepIndex(isEditing ? null : idx)}
                                title={isEditing ? 'Close Configuration' : 'Configure Parameters'}
                                style={{
                                  background: isEditing ? 'var(--primary-color)' : 'none',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '4px',
                                  color: isEditing ? '#fff' : 'var(--text-color)',
                                  cursor: 'pointer',
                                  padding: '3px 7px',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                }}
                              >
                                <FiSettings size={12} /> {isEditing ? 'Done' : 'Configure'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveStep(idx)}
                              title="Remove Step"
                              style={{
                                background: 'none',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                color: '#ff4757',
                                cursor: 'pointer',
                                padding: '3px 6px',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <FiTrash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Node Identity Row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '8px',
                              backgroundColor: `${actionDef.iconColor || '#3498db'}22`,
                              color: actionDef.iconColor || '#3498db',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Icon size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-color)' }}>
                              {actionDef.name}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                              {actionDef.description}
                            </div>
                          </div>
                        </div>

                        {/* Inline Configuration Drawer */}
                        {isEditing && (
                          <div
                            style={{
                              marginTop: '1rem',
                              paddingTop: '0.85rem',
                              borderTop: '1px solid var(--border-color)',
                              background: 'var(--subtle-bg)',
                              borderRadius: '8px',
                              padding: '0.85rem',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '0.65rem',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  color: 'var(--text-color)',
                                }}
                              >
                                Parameters for Step {idx + 1}: {actionDef.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => setEditingStepIndex(null)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-secondary)',
                                  cursor: 'pointer',
                                }}
                              >
                                <FiX size={14} />
                              </button>
                            </div>

                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                gap: '0.75rem',
                              }}
                            >
                              {(actionDef.configSchema || []).map((field) => (
                                <div
                                  key={field.key}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.25rem',
                                  }}
                                >
                                  <label
                                    style={{
                                      fontSize: '0.74rem',
                                      fontWeight: 700,
                                      color: 'var(--text-secondary)',
                                    }}
                                  >
                                    {field.label}
                                  </label>
                                  {field.type === 'text' && (
                                    <input
                                      type="text"
                                      value={step.config[field.key] ?? field.default}
                                      onChange={(e) =>
                                        handleUpdateStepConfig(field.key, e.target.value)
                                      }
                                      style={{
                                        padding: '0.38rem 0.55rem',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--card-bg)',
                                        color: 'var(--text-color)',
                                        fontSize: '0.8rem',
                                      }}
                                    />
                                  )}
                                  {field.type === 'number' && (
                                    <input
                                      type="number"
                                      min={field.min}
                                      max={field.max}
                                      step={field.step || 1}
                                      value={step.config[field.key] ?? field.default}
                                      onChange={(e) =>
                                        handleUpdateStepConfig(field.key, Number(e.target.value))
                                      }
                                      style={{
                                        padding: '0.38rem 0.55rem',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--card-bg)',
                                        color: 'var(--text-color)',
                                        fontSize: '0.8rem',
                                      }}
                                    />
                                  )}
                                  {field.type === 'select' && (
                                    <select
                                      value={step.config[field.key] ?? field.default}
                                      onChange={(e) =>
                                        handleUpdateStepConfig(field.key, e.target.value)
                                      }
                                      style={{
                                        padding: '0.38rem 0.55rem',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--card-bg)',
                                        color: 'var(--text-color)',
                                        fontSize: '0.8rem',
                                      }}
                                    >
                                      {field.options.map((opt) => (
                                        <option key={opt} value={opt}>
                                          {opt}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                  {field.type === 'color' && (
                                    <input
                                      type="color"
                                      value={step.config[field.key] ?? field.default}
                                      onChange={(e) =>
                                        handleUpdateStepConfig(field.key, e.target.value)
                                      }
                                      style={{
                                        width: '100%',
                                        height: '32px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color)',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                      }}
                                    />
                                  )}
                                  {field.type === 'checkbox' && (
                                    <label
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        marginTop: '0.2rem',
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={Boolean(step.config[field.key] ?? field.default)}
                                        onChange={(e) =>
                                          handleUpdateStepConfig(field.key, e.target.checked)
                                        }
                                      />
                                      <span>Enabled</span>
                                    </label>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Directional Connector Arrow between steps */}
                      {idx < steps.length - 1 && (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '0.45rem 0',
                            color: 'var(--primary-color)',
                            opacity: 0.8,
                          }}
                        >
                          <div
                            style={{
                              width: '2px',
                              height: '14px',
                              backgroundColor: 'var(--primary-color)',
                              opacity: 0.4,
                            }}
                          />
                          <div
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--card-bg)',
                              border: '1px solid var(--border-color)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                            }}
                          >
                            ↓
                          </div>
                          <div
                            style={{
                              width: '2px',
                              height: '14px',
                              backgroundColor: 'var(--primary-color)',
                              opacity: 0.4,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Bottom "+ Append Next Step" Drop Target */}
                <div
                  style={{
                    marginTop: '1.25rem',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: '1px dashed var(--border-color)',
                    backgroundColor: 'rgba(28, 153, 255, 0.03)',
                    textAlign: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                    }}
                  >
                    Drag & drop another tool here, or click <strong>+</strong> from the palette to append.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================
            COLUMN 3: RUN & OUTPUT STATION
            ========================================================= */}
        <div
          className={`studio-d-col ${mobileActiveTab === 'station' ? 'active-mobile' : ''}`}
          style={{
            borderLeft: '1px solid var(--border-color)',
            backgroundColor: 'var(--card-bg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {isStationCollapsed ? (
            <div
              onClick={() => setIsStationCollapsed(false)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '0.75rem 0.25rem',
                cursor: 'pointer',
                height: '100%',
                background: 'var(--card-bg)',
                userSelect: 'none',
              }}
              title="Click to expand Run & Outputs Station"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsStationCollapsed(false);
                }}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--subtle-bg)',
                  color: 'var(--text-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  marginBottom: '1.25rem',
                }}
                title="Expand Run & Outputs Station"
              >
                <FiChevronLeft size={16} />
              </button>
              <span
                style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                }}
              >
                3. Run & Outputs ({inputFiles.length})
              </span>
            </div>
          ) : (
            <>
              {/* Station Top Bar */}
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsStationCollapsed(true)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '3px',
                      borderRadius: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                    title="Collapse Run & Outputs Station"
                  >
                    <FiChevronRight size={15} />
                  </button>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-color)' }}>
                      3. Run & Outputs
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-secondary)',
                        display: 'block',
                        marginTop: '0.1rem',
                      }}
                    >
                      In-Memory Execution Station
                    </span>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '12px',
                    background:
                      inputFiles.length > 0 ? 'rgba(46, 213, 115, 0.15)' : 'var(--subtle-bg)',
                    color: inputFiles.length > 0 ? '#2ed573' : 'var(--text-secondary)',
                  }}
                >
                  {inputFiles.length} File{inputFiles.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Station Content (Scrollable) */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                }}
              >
                {/* Section A: Input Documents Queue */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-color)' }}>
                      Input Documents
                    </span>
                    {inputFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearFiles}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ff4757',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Clear Files
                      </button>
                    )}
                  </div>

                  {inputFiles.length === 0 ? (
                    <FileUpload
                      onFilesSelected={handleFilesSelected}
                      accept={acceptMimes}
                      multiple={true}
                      title="Drop files for pipeline"
                      description="Supports PDF, Images, Text"
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {/* File List */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                          maxHeight: '160px',
                          overflowY: 'auto',
                          paddingRight: '0.2rem',
                        }}
                      >
                        {inputFiles.map((f, idx) => (
                          <div
                            key={`${f.name}-${idx}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.4rem 0.6rem',
                              background: 'var(--subtle-bg)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                overflow: 'hidden',
                              }}
                            >
                              <FiFileText style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
                              <span
                                style={{
                                  fontWeight: 600,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {f.name}
                              </span>
                              <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>
                                ({formatFileSize(f.size)})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveQueuedFile(idx)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#ff4757',
                                cursor: 'pointer',
                                padding: '2px',
                              }}
                            >
                              <FiX size={12} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add More Files Trigger */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => handleFilesSelected(e.target.files)}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          padding: '0.35rem',
                          borderRadius: '6px',
                          border: '1px dashed var(--border-color)',
                          background: 'transparent',
                          color: 'var(--primary-color)',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        + Add More Documents
                      </button>
                    </div>
                  )}
                </div>

                {/* Section B: Execution Action & Progress */}
                <div>
                  <button
                    type="button"
                    onClick={handleRunPipeline}
                    disabled={isExecuting || steps.length === 0 || inputFiles.length === 0}
                    className="btn-primary"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '10px',
                      fontWeight: 800,
                      fontSize: '0.92rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 14px rgba(28, 153, 255, 0.25)',
                      cursor:
                        isExecuting || steps.length === 0 || inputFiles.length === 0
                          ? 'not-allowed'
                          : 'pointer',
                      opacity: isExecuting || steps.length === 0 || inputFiles.length === 0 ? 0.6 : 1,
                    }}
                  >
                    {isExecuting ? (
                      <>
                        <FiRefreshCw className="spin" size={16} /> Processing Pipeline...
                      </>
                    ) : (
                      <>
                        <FiPlay size={16} /> Run Pipeline ({steps.length} Steps)
                      </>
                    )}
                  </button>

                  {/* Live Execution Progress Details */}
                  {isExecuting && (
                    <div
                      style={{
                        marginTop: '0.85rem',
                        padding: '0.75rem',
                        background: 'var(--subtle-bg)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          marginBottom: '0.35rem',
                        }}
                      >
                        <span>Executing Pipeline:</span>
                        <span>
                          {executionProgress.fileIdx + 1} / {executionProgress.totalFiles || inputFiles.length}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '0.74rem',
                          color: 'var(--text-secondary)',
                          marginBottom: '0.4rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {executionProgress.currentFile
                          ? `File: ${executionProgress.currentFile}`
                          : 'Preparing documents...'}
                      </div>
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--primary-color)',
                          fontWeight: 700,
                        }}
                      >
                        {executionProgress.stepName || 'Running transformations...'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Section C: Output Results */}
                {outputResults && outputResults.files && outputResults.files.length > 0 && (
                  <div
                    style={{
                      padding: '1rem',
                      borderRadius: '12px',
                      background: 'rgba(46, 213, 115, 0.08)',
                      border: '1px solid rgba(46, 213, 115, 0.3)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        marginBottom: '0.5rem',
                        color: '#2ed573',
                      }}
                    >
                      <FiCheck size={18} />
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-color)' }}>
                        Execution Complete!
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: '0.76rem',
                        color: 'var(--text-secondary)',
                        margin: '0 0 0.85rem 0',
                        lineHeight: 1.3,
                      }}
                    >
                      Successfully transformed {outputResults.files.length} document
                      {outputResults.files.length !== 1 ? 's' : ''} through all {steps.length} stages.
                    </p>

                    {/* ZIP Archive CTA if multiple files */}
                    {outputResults.zipUrl && (
                      <a
                        href={outputResults.zipUrl}
                        download="workflow_output_bundle.zip"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.45rem',
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '0.55rem',
                          borderRadius: '8px',
                          background: '#2ed573',
                          color: '#0f172a',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          textDecoration: 'none',
                          marginBottom: '0.75rem',
                        }}
                      >
                        <FiArchive size={14} /> Download All as ZIP
                      </a>
                    )}

                    {/* Individual File Downloads */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                        maxHeight: '180px',
                        overflowY: 'auto',
                      }}
                    >
                      {outputResults.files.map((res, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.35rem 0.55rem',
                            background: 'var(--card-bg)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                          }}
                        >
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '140px',
                              fontWeight: 600,
                            }}
                          >
                            {res.file.name}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <button
                              type="button"
                              onClick={() => setPreviewFile(res)}
                              style={{
                                background: 'none',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                color: 'var(--text-color)',
                                cursor: 'pointer',
                                padding: '2px 5px',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                              title="Preview output file"
                            >
                              <FiEye size={12} />
                            </button>
                            <a
                              href={res.url}
                              download={res.file.name}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'var(--primary-color)',
                                color: '#fff',
                                textDecoration: 'none',
                                fontWeight: 700,
                                fontSize: '0.72rem',
                              }}
                            >
                              <FiDownload size={11} /> Save
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Universal In-Browser Preview Modal for Outputs */}
      {previewFile && (
        <UniversalPreviewModal
          isOpen={true}
          file={previewFile.file || previewFile}
          fileName={previewFile.file?.name || previewFile.name || 'output-file'}
          fileUrl={previewFile.url || (previewFile instanceof Blob ? URL.createObjectURL(previewFile) : null)}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
