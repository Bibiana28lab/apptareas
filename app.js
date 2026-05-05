const storageKey = "control-trabajos-v1";

const statuses = [
  { id: "pendiente", label: "Pendiente" },
  { id: "asignado", label: "Asignado" },
  { id: "en-curso", label: "En curso" },
  { id: "finalizado", label: "Finalizado" },
];

const starterData = {
  employees: [
    { id: "emp-1", name: "Ana Torres", role: "Coordinacion" },
    { id: "emp-2", name: "Carlos Ruiz", role: "Tecnico" },
    { id: "emp-3", name: "Marta Gomez", role: "Administracion" },
  ],
  tasks: [
    {
      id: "task-1",
      title: "Revisar pedido de materiales",
      client: "Deposito",
      employeeId: "emp-3",
      status: "pendiente",
      priority: "Alta",
      due: todayPlus(1),
      notes: "Confirmar cantidades y proveedor antes de aprobar la compra.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "task-2",
      title: "Instalacion en cliente Norte",
      client: "Cliente Norte",
      employeeId: "emp-2",
      status: "en-curso",
      priority: "Media",
      due: todayPlus(3),
      notes: "Llevar herramientas, validar acceso y cargar evidencia al terminar.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "task-3",
      title: "Llamar por aprobacion de presupuesto",
      client: "Comercial",
      employeeId: "emp-1",
      status: "asignado",
      priority: "Baja",
      due: todayPlus(5),
      notes: "Registrar respuesta y proxima accion.",
      createdAt: new Date().toISOString(),
    },
  ],
};

let state = loadState();
let draggedTaskId = null;

const board = document.querySelector("#board");
const taskDialog = document.querySelector("#taskDialog");
const employeeDialog = document.querySelector("#employeeDialog");

document.querySelector("#newTaskBtn").addEventListener("click", () => openTaskDialog());
document.querySelector("#closeDialogBtn").addEventListener("click", closeTaskDialog);
document.querySelector("#cancelDialogBtn").addEventListener("click", closeTaskDialog);
document.querySelector("#taskForm").addEventListener("submit", saveTaskFromDialog);
document.querySelector("#deleteTaskBtn").addEventListener("click", deleteCurrentTask);
document.querySelector("#quickTaskForm").addEventListener("submit", addQuickTask);
document.querySelector("#searchInput").addEventListener("input", render);
document.querySelector("#employeeFilter").addEventListener("change", render);
document.querySelector("#priorityFilter").addEventListener("change", render);
document.querySelector("#addEmployeeBtn").addEventListener("click", () => employeeDialog.showModal());
document.querySelector("#closeEmployeeBtn").addEventListener("click", () => employeeDialog.close());
document.querySelector("#cancelEmployeeBtn").addEventListener("click", () => employeeDialog.close());
document.querySelector("#employeeForm").addEventListener("submit", saveEmployee);
document.querySelector("#exportBtn").addEventListener("click", exportData);

render();

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(starterData);

  try {
    return JSON.parse(saved);
  } catch {
    return structuredClone(starterData);
  }
}

function persist() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function render() {
  renderSelectors();
  renderEmployees();
  renderBoard();
  renderStats();
}

function renderSelectors() {
  const selectedEmployee = document.querySelector("#employeeFilter").value || "all";
  const selectedQuickEmployee = document.querySelector("#quickEmployee").value || state.employees[0]?.id || "";
  const selectedTaskEmployee = document.querySelector("#taskEmployee").value || state.employees[0]?.id || "";
  const selectedTaskStatus = document.querySelector("#taskStatus").value || "pendiente";

  const employeeOptions = [
    `<option value="all">Todos</option>`,
    ...state.employees.map((employee) => `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`),
  ].join("");

  document.querySelector("#employeeFilter").innerHTML = employeeOptions;
  document.querySelector("#quickEmployee").innerHTML = state.employees
    .map((employee) => `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`)
    .join("");
  document.querySelector("#taskEmployee").innerHTML = state.employees
    .map((employee) => `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`)
    .join("");
  document.querySelector("#taskStatus").innerHTML = statuses
    .map((status) => `<option value="${status.id}">${status.label}</option>`)
    .join("");

  document.querySelector("#employeeFilter").value = state.employees.some((employee) => employee.id === selectedEmployee)
    ? selectedEmployee
    : "all";
  document.querySelector("#quickEmployee").value = state.employees.some((employee) => employee.id === selectedQuickEmployee)
    ? selectedQuickEmployee
    : state.employees[0]?.id || "";
  document.querySelector("#taskEmployee").value = state.employees.some((employee) => employee.id === selectedTaskEmployee)
    ? selectedTaskEmployee
    : state.employees[0]?.id || "";
  document.querySelector("#taskStatus").value = statuses.some((status) => status.id === selectedTaskStatus)
    ? selectedTaskStatus
    : "pendiente";
}

function renderEmployees() {
  document.querySelector("#employeeList").innerHTML = state.employees
    .map((employee) => {
      const activeCount = state.tasks.filter(
        (task) => task.employeeId === employee.id && task.status !== "finalizado"
      ).length;
      return `
        <div class="employee-row">
          <div class="avatar">${initials(employee.name)}</div>
          <div>
            <strong>${escapeHtml(employee.name)}</strong>
            <small>${escapeHtml(employee.role || "Sin rol")} · ${activeCount} activos</small>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderBoard() {
  const visibleTasks = getVisibleTasks();
  board.innerHTML = statuses
    .map((status) => {
      const tasks = visibleTasks.filter((task) => task.status === status.id);
      return `
        <article class="column" data-status="${status.id}">
          <div class="column-header">
            <h3>${status.label}</h3>
            <span class="count">${tasks.length}</span>
          </div>
          <div class="task-list" data-status="${status.id}">
            ${tasks.map(renderTaskCard).join("")}
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".task-card").forEach((card) => {
    card.addEventListener("dragstart", () => {
      draggedTaskId = card.dataset.id;
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => {
      draggedTaskId = null;
      card.classList.remove("dragging");
    });
    card.addEventListener("click", () => openTaskDialog(card.dataset.id));
  });

  document.querySelectorAll(".task-list").forEach((list) => {
    list.addEventListener("dragover", (event) => {
      event.preventDefault();
      list.classList.add("drop-target");
    });
    list.addEventListener("dragleave", () => list.classList.remove("drop-target"));
    list.addEventListener("drop", () => {
      list.classList.remove("drop-target");
      moveTask(draggedTaskId, list.dataset.status);
    });
  });
}

function renderTaskCard(task) {
  const employee = state.employees.find((person) => person.id === task.employeeId);
  const late = isLate(task);
  return `
    <div class="task-card priority-${task.priority}" draggable="true" data-id="${task.id}">
      <h4>${escapeHtml(task.title)}</h4>
      <p>${escapeHtml(task.client || "Sin cliente")} ${task.notes ? "· " + escapeHtml(task.notes) : ""}</p>
      <div class="task-meta">
        <span class="pill">${escapeHtml(employee?.name || "Sin responsable")}</span>
        <span class="pill">${task.priority}</span>
        ${task.due ? `<span class="pill ${late ? "late" : ""}">${formatDate(task.due)}</span>` : ""}
      </div>
    </div>
  `;
}

function renderStats() {
  const late = state.tasks.filter(isLate).length;
  document.querySelector("#statTotal").textContent = state.tasks.length;
  document.querySelector("#statProgress").textContent = state.tasks.filter((task) => task.status === "en-curso").length;
  document.querySelector("#statLate").textContent = late;
  document.querySelector("#statDone").textContent = state.tasks.filter((task) => task.status === "finalizado").length;
}

function getVisibleTasks() {
  const text = document.querySelector("#searchInput").value.trim().toLowerCase();
  const employeeId = document.querySelector("#employeeFilter").value;
  const priority = document.querySelector("#priorityFilter").value;

  return state.tasks.filter((task) => {
    const matchesText = [task.title, task.client, task.notes]
      .join(" ")
      .toLowerCase()
      .includes(text);
    const matchesEmployee = employeeId === "all" || task.employeeId === employeeId;
    const matchesPriority = priority === "all" || task.priority === priority;
    return matchesText && matchesEmployee && matchesPriority;
  });
}

function openTaskDialog(taskId = null) {
  const task = state.tasks.find((item) => item.id === taskId);
  document.querySelector("#dialogTitle").textContent = task ? "Editar trabajo" : "Nuevo trabajo";
  document.querySelector("#deleteTaskBtn").style.visibility = task ? "visible" : "hidden";
  document.querySelector("#taskId").value = task?.id || "";
  document.querySelector("#taskTitle").value = task?.title || "";
  document.querySelector("#taskClient").value = task?.client || "";
  document.querySelector("#taskEmployee").value = task?.employeeId || state.employees[0]?.id || "";
  document.querySelector("#taskStatus").value = task?.status || "pendiente";
  document.querySelector("#taskPriority").value = task?.priority || "Media";
  document.querySelector("#taskDue").value = task?.due || "";
  document.querySelector("#taskNotes").value = task?.notes || "";
  taskDialog.showModal();
}

function closeTaskDialog() {
  taskDialog.close();
}

function saveTaskFromDialog(event) {
  event.preventDefault();
  const id = document.querySelector("#taskId").value || crypto.randomUUID();
  const task = {
    id,
    title: document.querySelector("#taskTitle").value.trim(),
    client: document.querySelector("#taskClient").value.trim(),
    employeeId: document.querySelector("#taskEmployee").value,
    status: document.querySelector("#taskStatus").value,
    priority: document.querySelector("#taskPriority").value,
    due: document.querySelector("#taskDue").value,
    notes: document.querySelector("#taskNotes").value.trim(),
    createdAt: state.tasks.find((item) => item.id === id)?.createdAt || new Date().toISOString(),
  };

  state.tasks = state.tasks.some((item) => item.id === id)
    ? state.tasks.map((item) => (item.id === id ? task : item))
    : [task, ...state.tasks];
  persist();
  closeTaskDialog();
  render();
}

function deleteCurrentTask() {
  const id = document.querySelector("#taskId").value;
  state.tasks = state.tasks.filter((task) => task.id !== id);
  persist();
  closeTaskDialog();
  render();
}

function addQuickTask(event) {
  event.preventDefault();
  state.tasks.unshift({
    id: crypto.randomUUID(),
    title: document.querySelector("#quickTitle").value.trim(),
    client: "",
    employeeId: document.querySelector("#quickEmployee").value,
    status: "pendiente",
    priority: document.querySelector("#quickPriority").value,
    due: document.querySelector("#quickDue").value,
    notes: "",
    createdAt: new Date().toISOString(),
  });
  event.target.reset();
  persist();
  render();
}

function saveEmployee(event) {
  event.preventDefault();
  state.employees.push({
    id: crypto.randomUUID(),
    name: document.querySelector("#employeeName").value.trim(),
    role: document.querySelector("#employeeRole").value.trim(),
  });
  event.target.reset();
  employeeDialog.close();
  persist();
  render();
}

function moveTask(taskId, status) {
  if (!taskId) return;
  state.tasks = state.tasks.map((task) => (task.id === taskId ? { ...task, status } : task));
  persist();
  render();
}

function exportData() {
  const report = state.tasks.map((task) => {
    const employee = state.employees.find((person) => person.id === task.employeeId);
    const status = statuses.find((item) => item.id === task.status);
    return {
      trabajo: task.title,
      cliente: task.client,
      responsable: employee?.name || "",
      estado: status?.label || task.status,
      prioridad: task.priority,
      vence: task.due,
      detalle: task.notes,
    };
  });

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "trabajos-asignados.json";
  link.click();
  URL.revokeObjectURL(url);
}

function isLate(task) {
  if (!task.due || task.status === "finalizado") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${task.due}T00:00:00`);
  return due < today;
}

function todayPlus(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(
    new Date(`${value}T00:00:00`)
  );
}

function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
