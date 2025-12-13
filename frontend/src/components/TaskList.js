import { useEffect, useState } from "react";
import { useTheme } from './ThemeContext';

export default function TaskList() {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  
  const [tasks, setTasks] = useState([]);
  const [runningTasks, setRunningTasks] = useState({});
  const [selectedTask, setSelectedTask] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    minute: "*",
    hour: "*",
    day_of_week: "*",
    day_of_month: "*",
    month_of_year: "*",
  });

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8018/api";

  async function fetchTasks() {
    try {
      const res = await fetch(`${API_URL}/tasks/`);
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    }
  }

  async function toggleTaskEnabled(taskId, currentEnabled) {
    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: !currentEnabled,
        }),
      });

      if (res.ok) {
        // Update de lokale state direct voor snelle feedback
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === taskId 
              ? { ...task, enabled: !currentEnabled }
              : task
          )
        );
      } else {
        alert("Failed to update task status");
      }
    } catch (err) {
      console.error("Failed to toggle task:", err);
      alert("Failed to update task status");
    }
  }

  async function runTask(taskPath) {
    try {
      const res = await fetch(`${API_URL}/tasks/run/${taskPath}/`, {
        method: "POST",
      });
      const data = await res.json();
      const taskId = data.task_id;

      setRunningTasks(prev => ({ 
        ...prev, 
        [taskPath]: { taskId, status: data.status } 
      }));

      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_URL}/tasks/status/${taskId}/`);
          const statusData = await statusRes.json();
          
          setRunningTasks(prev => ({ 
            ...prev, 
            [taskPath]: { taskId, status: statusData.status } 
          }));

          if (statusData.status === "SUCCESS" || statusData.status === "FAILURE") {
            clearInterval(interval);
            fetchTasks();
            
            setTimeout(() => {
              setRunningTasks(prev => {
                const newState = { ...prev };
                delete newState[taskPath];
                return newState;
              });
            }, 3000);
          }
        } catch (err) {
          console.error("Failed to fetch task status:", err);
          clearInterval(interval);
          setRunningTasks(prev => {
            const newState = { ...prev };
            delete newState[taskPath];
            return newState;
          });
        }
      }, 2000);
    } catch (err) {
      console.error("Failed to start task:", err);
    }
  }

  function openScheduleModal(task) {
    setSelectedTask(task);
    
    if (task.schedule && task.schedule.type === "crontab") {
      setScheduleForm({
        minute: task.schedule.minute || "*",
        hour: task.schedule.hour || "*",
        day_of_week: task.schedule.day_of_week || "*",
        day_of_month: task.schedule.day_of_month || "*",
        month_of_year: task.schedule.month_of_year || "*",
      });
    } else {
      setScheduleForm({
        minute: "*",
        hour: "*",
        day_of_week: "*",
        day_of_month: "*",
        month_of_year: "*",
      });
    }
  }

  function closeScheduleModal() {
    setSelectedTask(null);
  }

  async function saveSchedule() {
    if (!selectedTask) return;

    try {
      const res = await fetch(`${API_URL}/tasks/${selectedTask.id}/schedule/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schedule_type: "crontab",
          ...scheduleForm,
        }),
      });

      if (res.ok) {
        alert("Schedule updated successfully!");
        closeScheduleModal();
        fetchTasks();
      } else {
        alert("Failed to update schedule");
      }
    } catch (err) {
      console.error("Failed to save schedule:", err);
      alert("Failed to update schedule");
    }
  }

  function formatSchedule(schedule) {
    if (!schedule) return "—";
    
    if (schedule.type === "crontab") {
      return `${schedule.minute} ${schedule.hour} ${schedule.day_of_month} ${schedule.month_of_year} ${schedule.day_of_week}`;
    } else if (schedule.type === "interval") {
      return `Every ${schedule.every} ${schedule.period}`;
    }
    
    return "—";
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  const getStatusDisplay = (status) => {
    const statusConfig = {
      PENDING: { text: "Pending...", color: "#f59e0b", icon: "⏳" },
      STARTED: { text: "Running...", color: "#3b82f6", icon: "⚙️" },
      SUCCESS: { text: "Success", color: "#10b981", icon: "✓" },
      FAILURE: { text: "Failed", color: "#ef4444", icon: "✗" },
    };
    
    const config = statusConfig[status] || { text: "—", color: "#6b7280", icon: "" };
    return (
      <span style={{ color: config.color, fontWeight: "500" }}>
        {config.icon} {config.text}
      </span>
    );
  };

  return (
    <div style={{ padding: "20px" }}>
      <h3>Planned Tasks</h3>
      {tasks.length === 0 ? (
        <p>No tasks found.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: "8px" }}>Enabled</th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: "8px" }}>Name</th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: "8px" }}>Last Run</th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: "8px" }}>Status</th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: "8px" }}>Schedule</th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: "8px" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => {
              const runningTask = runningTasks[task.task];
              const isRunning = runningTask && 
                (runningTask.status === "PENDING" || runningTask.status === "STARTED");

              return (
                <tr key={task.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                    <label style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      cursor: "pointer",
                      userSelect: "none"
                    }}>
                      <div style={{ position: "relative" }}>
                        <input
                          type="checkbox"
                          checked={task.enabled}
                          onChange={() => toggleTaskEnabled(task.id, task.enabled)}
                          style={{ display: "none" }}
                        />
                        <div
                          style={{
                            width: "44px",
                            height: "24px",
                            backgroundColor: task.enabled ? "#10b981" : "#d1d5db",
                            borderRadius: "12px",
                            position: "relative",
                            transition: "background-color 0.2s",
                          }}
                        >
                          <div
                            style={{
                              width: "20px",
                              height: "20px",
                              backgroundColor: "white",
                              borderRadius: "50%",
                              position: "absolute",
                              top: "2px",
                              left: task.enabled ? "22px" : "2px",
                              transition: "left 0.2s",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                            }}
                          />
                        </div>
                      </div>
                    </label>
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                    {task.name}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                    {task.last_run_at ?? "—"}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                    {runningTask ? getStatusDisplay(runningTask.status) : "—"}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                    <button
                      onClick={() => openScheduleModal(task)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#6b7280",
                        fontSize: "18px",
                        padding: "4px 8px",
                      }}
                      title="Edit schedule"
                    >
                    <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>
                      {formatSchedule(task.schedule)}
                    </span>
                    </button>
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                    <button 
                      onClick={() => runTask(task.task)}
                      disabled={isRunning}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: isRunning ? "#d1d5db" : "#3b82f6",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: isRunning ? "not-allowed" : "pointer",
                        opacity: isRunning ? 0.6 : 1,
                      }}
                    >
                      {isRunning ? "Running..." : "Start Now"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Schedule Edit Modal */}
      {selectedTask && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={closeScheduleModal}
        >
          <div
            style={{
              backgroundColor: isDarkMode ? "#1f2937" : "#ffffff",
              color: isDarkMode ? "#f3f4f6" : "#111827",
              borderRadius: "8px",
              padding: "24px",
              maxWidth: "300px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Edit Schedule: {selectedTask.name}</h3>
            
            <div style={{ marginBottom: "16px" }}>
              <p style={{ 
                fontSize: "14px", 
                color: isDarkMode ? "#9ca3af" : "#6b7280", 
                marginBottom: "8px" 
              }}>
                Current schedule: {formatSchedule(selectedTask.schedule)}
              </p>
              <p style={{ 
                fontSize: "12px", 
                color: isDarkMode ? "#6b7280" : "#9ca3af" 
              }}>
                Use * for "any value" (e.g., * * * * * means every minute)
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ 
                  display: "block", 
                  marginBottom: "4px", 
                  fontWeight: "500",
                  color: isDarkMode ? "#f3f4f6" : "#111827"
                }}>
                  Minute (0-59)
                </label>
                <input
                  type="text"
                  value={scheduleForm.minute}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, minute: e.target.value })}
                  placeholder="*"
                  style={{
                    width: "10ch",
                    padding: "8px",
                    border: `1px solid ${isDarkMode ? "#4b5563" : "#d1d5db"}`,
                    borderRadius: "4px",
                    backgroundColor: isDarkMode ? "#374151" : "#ffffff",
                    color: isDarkMode ? "#f3f4f6" : "#111827",
                  }}
                />
              </div>

              <div>
                <label style={{ 
                  display: "block", 
                  marginBottom: "4px", 
                  fontWeight: "500",
                  color: isDarkMode ? "#f3f4f6" : "#111827"
                }}>
                  Hour (0-23)
                </label>
                <input
                  type="text"
                  value={scheduleForm.hour}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, hour: e.target.value })}
                  placeholder="*"
                  style={{
                    width: "10ch",
                    padding: "8px",
                    border: `1px solid ${isDarkMode ? "#4b5563" : "#d1d5db"}`,
                    borderRadius: "4px",
                    backgroundColor: isDarkMode ? "#374151" : "#ffffff",
                    color: isDarkMode ? "#f3f4f6" : "#111827",
                  }}
                />
              </div>

              <div>
                <label style={{ 
                  display: "block", 
                  marginBottom: "4px", 
                  fontWeight: "500",
                  color: isDarkMode ? "#f3f4f6" : "#111827"
                }}>
                  Day of Month (1-31)
                </label>
                <input
                  type="text"
                  value={scheduleForm.day_of_month}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, day_of_month: e.target.value })}
                  placeholder="*"
                  style={{
                    width: "10ch",
                    padding: "8px",
                    border: `1px solid ${isDarkMode ? "#4b5563" : "#d1d5db"}`,
                    borderRadius: "4px",
                    backgroundColor: isDarkMode ? "#374151" : "#ffffff",
                    color: isDarkMode ? "#f3f4f6" : "#111827",
                  }}
                />
              </div>

              <div>
                <label style={{ 
                  display: "block", 
                  marginBottom: "4px", 
                  fontWeight: "500",
                  color: isDarkMode ? "#f3f4f6" : "#111827"
                }}>
                  Month of Year (1-12)
                </label>
                <input
                  type="text"
                  value={scheduleForm.month_of_year}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, month_of_year: e.target.value })}
                  placeholder="*"
                  style={{
                    width: "10ch",
                    padding: "8px",
                    border: `1px solid ${isDarkMode ? "#4b5563" : "#d1d5db"}`,
                    borderRadius: "4px",
                    backgroundColor: isDarkMode ? "#374151" : "#ffffff",
                    color: isDarkMode ? "#f3f4f6" : "#111827",
                  }}
                />
              </div>

              <div>
                <label style={{ 
                  display: "block", 
                  marginBottom: "4px", 
                  fontWeight: "500",
                  color: isDarkMode ? "#f3f4f6" : "#111827"
                }}>
                  Day of Week (0-6, 0=Sunday)
                </label>
                <input
                  type="text"
                  value={scheduleForm.day_of_week}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, day_of_week: e.target.value })}
                  placeholder="*"
                  style={{
                    width: "10ch",
                    padding: "8px",
                    border: `1px solid ${isDarkMode ? "#4b5563" : "#d1d5db"}`,
                    borderRadius: "4px",
                    backgroundColor: isDarkMode ? "#374151" : "#ffffff",
                    color: isDarkMode ? "#f3f4f6" : "#111827",
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: "24px", display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={closeScheduleModal}
                style={{
                  padding: "8px 16px",
                  backgroundColor: isDarkMode ? "#374151" : "#e5e7eb",
                  color: isDarkMode ? "#f3f4f6" : "#374151",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveSchedule}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}