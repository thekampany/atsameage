import { useEffect, useState } from "react";

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [taskStatuses, setTaskStatuses] = useState({}); // task_id → status

  async function fetchTasks() {
    try {
      const res = await fetch("http://localhost:8018/api/tasks/");
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    }
  }

  async function runTask(taskPath) {
    try {
      const res = await fetch(`http://localhost:8018/api/tasks/run/${taskPath}/`, {
        method: "POST",
      });
      const data = await res.json(); // {task_id: "...", status: "PENDING"}
      const taskId = data.task_id;

      // Init status
      setTaskStatuses(prev => ({ ...prev, [taskId]: data.status }));

      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch(`http://localhost:8018/api/tasks/status/${taskId}/`);
          const statusData = await statusRes.json(); // {status: "PENDING|STARTED|SUCCESS|FAILURE"}
          setTaskStatuses(prev => ({ ...prev, [taskId]: statusData.status }));

          if (statusData.status === "SUCCESS" || statusData.status === "FAILURE") {
            clearInterval(interval);
            fetchTasks(); 
          }
        } catch (err) {
          console.error("Failed to fetch task status:", err);
        }
      }, 2000);
    } catch (err) {
      console.error("Failed to start task:", err);
    }
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h3>Planned Tasks</h3>
      {tasks.length === 0 ? (
        <p>No tasks found.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: "8px" }}>Name</th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: "8px" }}>Last Run</th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: "8px" }}>Status</th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: "8px" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => {
              const statusEntry = Object.entries(taskStatuses).find(
                ([id, _]) => task.id === parseInt(id) || false
              );
              const status = statusEntry ? statusEntry[1] : "—";

              return (
                <tr key={task.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>{task.name}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                    {task.last_run_at ?? "—"}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                    {status}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "8px" }}>
                    <button onClick={() => runTask(task.task)}>
                      Start Now
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
