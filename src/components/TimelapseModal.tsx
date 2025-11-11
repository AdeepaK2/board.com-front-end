import { useState, useEffect } from "react";
import { X, Film, Download, CheckCircle, AlertCircle } from "lucide-react";
import "./TimelapseModal.css";

interface TimelapseModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  boardName: string;
}

interface JobStatus {
  jobId: string;
  status: string;
  progress: number;
  message: string;
  videoUrl?: string;
}

const API_URL = "http://" + window.location.hostname + ":8081/api/boards";

export const TimelapseModal = ({
  isOpen,
  onClose,
  boardId,
  boardName,
}: TimelapseModalProps) => {
  const [duration, setDuration] = useState(10);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    let pollInterval: number | undefined;

    if (
      jobStatus &&
      jobStatus.status !== "COMPLETED" &&
      jobStatus.status !== "FAILED"
    ) {
      // Poll for status every 1 second
      pollInterval = window.setInterval(() => {
        pollJobStatus(jobStatus.jobId);
      }, 1000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [jobStatus]);

  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`${API_URL}/timelapse-status/${jobId}`);
      const data = await response.json();

      if (data.success) {
        setJobStatus(data);

        if (data.status === "COMPLETED") {
          setIsGenerating(false);
        } else if (data.status === "FAILED") {
          setIsGenerating(false);
          setError(data.message);
        }
      }
    } catch (err) {
      console.error("Failed to poll job status:", err);
    }
  };

  const handleGenerateTimelapse = async () => {
    setError("");
    setIsGenerating(true);
    setJobStatus(null);

    try {
      const response = await fetch(`${API_URL}/generate-timelapse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId,
          duration,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setJobStatus(data);
      } else {
        setError(data.error || "Failed to start timelapse generation");
        setIsGenerating(false);
      }
    } catch (err) {
      setError("Failed to generate timelapse");
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (jobStatus && jobStatus.videoUrl) {
      // videoUrl already contains the full path starting with /api/boards
      const downloadUrl = `http://${window.location.hostname}:8081${jobStatus.videoUrl}`;
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `timelapse-${boardName}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleClose = () => {
    setJobStatus(null);
    setError("");
    setIsGenerating(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="timelapse-modal-overlay" onClick={handleClose}>
      <div className="timelapse-modal" onClick={(e) => e.stopPropagation()}>
        <div className="timelapse-modal-header">
          <div className="timelapse-title">
            <Film size={24} />
            <h2>Generate Timelapse Video</h2>
          </div>
          <button onClick={handleClose} className="btn-close">
            <X size={20} />
          </button>
        </div>

        <div className="timelapse-modal-body">
          <div className="board-info-banner">
            <strong>{boardName}</strong>
          </div>

          {!jobStatus && !isGenerating && (
            <div className="timelapse-settings">
              <label>
                <span>Video Duration (seconds):</span>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="duration-input"
                />
              </label>
              <p className="info-text">
                The timelapse will show your drawing process from start to
                finish.
              </p>
              <button
                onClick={handleGenerateTimelapse}
                className="btn-generate"
              >
                <Film size={18} />
                Generate Timelapse
              </button>
            </div>
          )}

          {isGenerating && jobStatus && (
            <div className="timelapse-progress">
              <div className="progress-info">
                <span className="status-badge status-{jobStatus.status.toLowerCase()}">
                  {jobStatus.status}
                </span>
                <span className="progress-percent">{jobStatus.progress}%</span>
              </div>

              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${jobStatus.progress}%` }}
                />
              </div>

              <p className="progress-message">{jobStatus.message}</p>

              {jobStatus.status === "PROCESSING" && (
                <div className="spinner-container">
                  <div className="spinner"></div>
                </div>
              )}
            </div>
          )}

          {jobStatus && jobStatus.status === "COMPLETED" && (
            <div className="timelapse-completed">
              <div className="success-icon">
                <CheckCircle size={48} color="#10b981" />
              </div>
              <h3>Timelapse Ready!</h3>
              <p>Your timelapse video has been generated successfully.</p>
              <button onClick={handleDownload} className="btn-download">
                <Download size={18} />
                Download Video
              </button>
            </div>
          )}

          {error && (
            <div className="timelapse-error">
              <AlertCircle size={24} color="#ef4444" />
              <p>{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
