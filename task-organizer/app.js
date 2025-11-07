const form = document.getElementById('task-form');
const input = document.getElementById('task-input');
const lists = {
  house: document.getElementById('house-list'),
  kitchen: document.getElementById('kitchen-list'),
  study: document.getElementById('study-list')
};
const template = document.getElementById('task-template');

const CATEGORY_MAP = {
  house: {
    keywords: [
      'clean',
      'vacuum',
      'laundry',
      'fold',
      'organize',
      'bill',
      'rent',
      'utilities',
      'trash',
      'garden',
      'repairs',
      'declutter',
      'sweep',
      'mop',
      'paint',
      'fix',
      'call landlord',
      'schedule maintenance'
    ],
    defaultMessage: 'House looks empty. Add something cozy to tackle!'
  },
  kitchen: {
    keywords: [
      'cook',
      'meal',
      'recipe',
      'bake',
      'dinner',
      'lunch',
      'breakfast',
      'grocery',
      'shop',
      'produce',
      'snack',
      'dishes',
      'dishwasher',
      'fridge',
      'pantry',
      'meal prep',
      'wash vegetables',
      'marinate',
      'preheat'
    ],
    defaultMessage: 'Kitchen is sparkling clean—no tasks here yet.'
  },
  study: {
    keywords: [
      'study',
      'class',
      'course',
      'assignment',
      'homework',
      'read',
      'review',
      'exam',
      'quiz',
      'resume',
      'cover letter',
      'portfolio',
      'network',
      'interview',
      'job',
      'apply',
      'application',
      'linkedin',
      'practice',
      'research'
    ],
    defaultMessage: 'Line up those ambitions—nothing scheduled yet.'
  }
};

const STORAGE_KEY = 'smart-task-sorter';

function sanitizeTask(text) {
  return text
    .trim()
    .replace(/\s+/g, ' ');
}

function findCategory(taskText) {
  const normalized = taskText.toLowerCase();

  for (const [category, { keywords }] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some(keyword => normalized.includes(keyword))) {
      return category;
    }
  }

  // fallback: choose based on first word heuristics
  const fallback = normalized.split(' ')[0];
  if (['cook', 'kitchen', 'recipe'].includes(fallback)) return 'kitchen';
  if (['study', 'course', 'job', 'apply'].includes(fallback)) return 'study';
  return 'house';
}

function createTaskElement(task) {
  const node = template.content.firstElementChild.cloneNode(true);
  const textEl = node.querySelector('.task-text');
  textEl.textContent = task.text;

  const removeBtn = node.querySelector('.remove-btn');
  removeBtn.addEventListener('click', () => {
    removeTask(task.id);
  });

  const reclassBtn = node.querySelector('.reclassify-btn');
  const menu = node.querySelector('.reclassify-menu');
  reclassBtn.addEventListener('click', () => {
    menu.classList.toggle('open');
  });

  menu.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
      menu.classList.remove('open');
      reclassifyTask(task.id, button.dataset.category);
    });
  });

  node.addEventListener('click', event => {
    if (!node.contains(event.target.closest('.reclassify-btn'))) {
      menu.classList.remove('open');
    }
  });

  return node;
}

function renderEmptyState(list, message) {
  const empty = document.createElement('li');
  empty.className = 'empty-state';
  empty.textContent = message;
  list.appendChild(empty);
}

function render(tasks) {
  for (const [category, list] of Object.entries(lists)) {
    list.innerHTML = '';
    const categoryTasks = tasks.filter(task => task.category === category);
    if (categoryTasks.length === 0) {
      renderEmptyState(list, CATEGORY_MAP[category].defaultMessage);
    } else {
      const fragment = document.createDocumentFragment();
      categoryTasks.forEach(task => fragment.appendChild(createTaskElement(task)));
      list.appendChild(fragment);
    }
  }
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (error) {
    console.error('Failed to parse saved tasks', error);
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function addTask(text) {
  const task = {
    id: crypto.randomUUID(),
    text,
    category: findCategory(text)
  };
  const tasks = loadTasks();
  tasks.push(task);
  saveTasks(tasks);
  render(tasks);
}

function removeTask(id) {
  const tasks = loadTasks().filter(task => task.id !== id);
  saveTasks(tasks);
  render(tasks);
}

function reclassifyTask(id, category) {
  const tasks = loadTasks().map(task => (task.id === id ? { ...task, category } : task));
  saveTasks(tasks);
  render(tasks);
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const value = sanitizeTask(input.value);
  if (!value) return;
  addTask(value);
  input.value = '';
  input.focus();
});

// Quick keyword helper buttons
const suggestionContainer = document.querySelector('.suggestion-tags');
if (suggestionContainer) {
  suggestionContainer.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const keyword = button.dataset.keyword;
    const baseText = sanitizeTask(input.value);
    input.value = baseText ? `${baseText} ${keyword}` : keyword;
    input.focus();
  });
}

// Initial render
const initialTasks = loadTasks();
render(initialTasks);
