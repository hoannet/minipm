// script.js
document.addEventListener('DOMContentLoaded', function() {
    // Các phần tử DOM
    const taskNameInput = document.getElementById('taskName');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const taskTableBody = document.getElementById('taskTableBody');
    const ganttChart = document.getElementById('ganttChart');
    const exportBtn = document.getElementById('exportBtn');
    const importFile = document.getElementById('importFile');
    
    // Khởi tạo ngày mặc định
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    startDateInput.value = todayStr;
    
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];
    endDateInput.value = nextWeekStr;
    
    // Mảng lưu trữ các công việc
    let tasks = [];
    
    // Hiển thị trạng thái đồng bộ
    const syncStatus = document.createElement('div');
    syncStatus.id = 'syncStatus';
    syncStatus.style.margin = '10px 0';
    syncStatus.style.fontSize = '12px';
    syncStatus.style.color = '#666';
    document.querySelector('.container').appendChild(syncStatus);
    
    // Load dữ liệu từ sync storage
    function loadTasks() {
      syncStatus.textContent = 'Đang tải dữ liệu...';
      
      chrome.storage.sync.get(['tasks'], function(result) {
        tasks = result.tasks || [];
        renderTasks();
        renderGanttChart();
        
        const lastSync = new Date().toLocaleString('vi-VN');
        syncStatus.textContent = `Đã đồng bộ lúc: ${lastSync}`;
      });
    }
    
    // Lưu dữ liệu vào sync storage
    function saveTasks() {
      syncStatus.textContent = 'Đang đồng bộ...';
      
      // Kiểm tra kích thước dữ liệu (giới hạn của sync storage là 100KB/item)
      const jsonSize = JSON.stringify(tasks).length;
      
      if (jsonSize > 100000) { // 100KB
        alert('Cảnh báo: Dữ liệu đang tiệm cận giới hạn đồng bộ của Chrome (100KB). Hãy xuất dữ liệu để đảm bảo an toàn.');
      }
      
      chrome.storage.sync.set({ tasks: tasks }, function() {
        if (chrome.runtime.lastError) {
          alert('Lỗi đồng bộ: ' + chrome.runtime.lastError.message);
          syncStatus.textContent = 'Lỗi đồng bộ!';
        } else {
          const lastSync = new Date().toLocaleString('vi-VN');
          syncStatus.textContent = `Đã đồng bộ lúc: ${lastSync}`;
        }
      });
    }
    
    // Thêm một công việc mới
    function addTask() {
      const name = taskNameInput.value.trim();
      const startDate = startDateInput.value;
      const endDate = endDateInput.value;
      
      if (!name || !startDate || !endDate) {
        alert('Vui lòng nhập đầy đủ thông tin công việc!');
        return;
      }
      
      if (new Date(endDate) < new Date(startDate)) {
        alert('Ngày kết thúc phải sau ngày bắt đầu!');
        return;
      }
      
      const task = {
        id: Date.now(),
        name: name,
        startDate: startDate,
        endDate: endDate
      };
      
      tasks.push(task);
      saveTasks();
      renderTasks();
      renderGanttChart();
      
      // Reset form
      taskNameInput.value = '';
    }
    
    // Hiển thị danh sách công việc
    function renderTasks() {
      taskTableBody.innerHTML = '';
      
      tasks.forEach(task => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
          <td>${task.name}</td>
          <td>${formatDate(task.startDate)}</td>
          <td>${formatDate(task.endDate)}</td>
          <td>
            <button class="edit-btn" data-id="${task.id}">Sửa</button>
            <button class="delete-btn" data-id="${task.id}">Xóa</button>
          </td>
        `;
        
        taskTableBody.appendChild(row);
      });
      
      // Thêm event listeners cho các nút
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const taskId = parseInt(this.getAttribute('data-id'));
          deleteTask(taskId);
        });
      });
      
      document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const taskId = parseInt(this.getAttribute('data-id'));
          editTask(taskId);
        });
      });
    }
    
    // Hiển thị biểu đồ Gantt
    function renderGanttChart() {
      if (tasks.length === 0) {
        ganttChart.innerHTML = '<p>Chưa có công việc nào.</p>';
        return;
      }
      
      // Tìm ngày sớm nhất và muộn nhất
      let minDate = new Date(tasks[0].startDate);
      let maxDate = new Date(tasks[0].endDate);
      
      tasks.forEach(task => {
        const startDate = new Date(task.startDate);
        const endDate = new Date(task.endDate);
        
        if (startDate < minDate) minDate = startDate;
        if (endDate > maxDate) maxDate = endDate;
      });
      
      // Thêm thêm 2 ngày đệm
      minDate.setDate(minDate.getDate() - 2);
      maxDate.setDate(maxDate.getDate() + 2);
      
      // Tính số ngày hiển thị
      const totalDays = Math.round((maxDate - minDate) / (24 * 60 * 60 * 1000));
      
      // Tạo phần đánh dấu ngày
      let datesHTML = '<div class="gantt-dates">';
      
      for (let i = 0; i <= totalDays; i += Math.max(1, Math.floor(totalDays / 10))) {
        const date = new Date(minDate);
        date.setDate(minDate.getDate() + i);
        datesHTML += `<div class="gantt-date-marker">${formatDate(date.toISOString().split('T')[0])}</div>`;
      }
      
      datesHTML += '</div>';
      
      // Tạo các thanh Gantt
      let barsHTML = '';
      
      tasks.forEach(task => {
        const startDate = new Date(task.startDate);
        const endDate = new Date(task.endDate);
        
        const left = ((startDate - minDate) / (24 * 60 * 60 * 1000)) / totalDays * 100;
        const width = ((endDate - startDate) / (24 * 60 * 60 * 1000)) / totalDays * 100;
        
        barsHTML += `
          <div class="gantt-row">
            <div class="gantt-label">${task.name}</div>
            <div class="gantt-bar-container">
              <div class="gantt-bar" style="left: ${left}%; width: ${width}%;"></div>
            </div>
          </div>
        `;
      });
      
      ganttChart.innerHTML = datesHTML + barsHTML;
    }
    
    // Xóa công việc
    function deleteTask(taskId) {
      if (confirm('Bạn có chắc chắn muốn xóa công việc này không?')) {
        tasks = tasks.filter(task => task.id !== taskId);
        saveTasks();
        renderTasks();
        renderGanttChart();
      }
    }
    
    // Sửa công việc
    function editTask(taskId) {
      const task = tasks.find(task => task.id === taskId);
      
      if (task) {
        taskNameInput.value = task.name;
        startDateInput.value = task.startDate;
        endDateInput.value = task.endDate;
        
        // Xóa công việc cũ
        tasks = tasks.filter(t => t.id !== taskId);
        saveTasks();
        renderTasks();
        renderGanttChart();
        
        // Focus vào input
        taskNameInput.focus();
      }
    }
    
    // Định dạng ngày
    function formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleDateString('vi-VN');
    }
    
    // Export dữ liệu
    function exportData() {
      const dataStr = JSON.stringify(tasks, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      
      const exportLink = document.createElement('a');
      exportLink.setAttribute('href', dataUri);
      exportLink.setAttribute('download', `task-manager-export-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(exportLink);
      exportLink.click();
      document.body.removeChild(exportLink);
    }
    
    // Import dữ liệu
    function importData(event) {
      const file = event.target.files[0];
      
      if (file) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
          try {
            const importedTasks = JSON.parse(e.target.result);
            
            if (Array.isArray(importedTasks)) {
              tasks = importedTasks;
              saveTasks();
              renderTasks();
              renderGanttChart();
              alert('Nhập dữ liệu thành công!');
            } else {
              alert('File không hợp lệ. Vui lòng chọn file JSON đúng định dạng.');
            }
          } catch (error) {
            alert('Có lỗi xảy ra khi đọc file: ' + error.message);
          }
        };
        
        reader.readAsText(file);
      }
      
      // Reset input file
      event.target.value = '';
    }
    
    // Lắng nghe sự kiện thay đổi từ các thiết bị khác
    chrome.storage.onChanged.addListener(function(changes, namespace) {
      if (namespace === 'sync' && changes.tasks) {
        // Kiểm tra xem dữ liệu có thay đổi thực sự không
        const newTasksStr = JSON.stringify(changes.tasks.newValue || []);
        const currentTasksStr = JSON.stringify(tasks);
        
        if (newTasksStr !== currentTasksStr) {
          tasks = changes.tasks.newValue || [];
          renderTasks();
          renderGanttChart();
          
          const lastSync = new Date().toLocaleString('vi-VN');
          syncStatus.textContent = `Đã đồng bộ từ thiết bị khác lúc: ${lastSync}`;
        }
      }
    });
    
    // Event listeners
    addTaskBtn.addEventListener('click', addTask);
    exportBtn.addEventListener('click', exportData);
    importFile.addEventListener('change', importData);
    
    // Thêm nút Force Sync
    const syncBtn = document.createElement('button');
    syncBtn.textContent = 'Đồng bộ ngay';
    syncBtn.style.marginLeft = '10px';
    document.querySelector('.actions').appendChild(syncBtn);
    
    syncBtn.addEventListener('click', function() {
      loadTasks();
    });
    
    // Load dữ liệu ban đầu
    loadTasks();
  });