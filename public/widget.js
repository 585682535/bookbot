(function() {
  'use strict';
  
  const WIDGET_API = window.location.origin; // Используем текущий домен для разработки
  
  // Получить параметры из data-атрибутов
  const script = document.currentScript;
  const businessSlug = script.getAttribute('data-business');
  const color = script.getAttribute('data-color') || '#2563eb';
  const position = script.getAttribute('data-position') || 'bottom-right';
  
  // Создать плавающую кнопку
  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'bookbot-widget-container';
  buttonContainer.innerHTML = `
    <style>
      .bookbot-widget-button {
        position: fixed;
        ${position.includes('bottom') ? 'bottom: 24px;' : 'top: 24px;'}
        ${position.includes('right') ? 'right: 24px;' : 'left: 24px;'}
        background: ${color};
        color: white;
        padding: 14px 24px;
        border-radius: 50px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 15px;
        font-weight: 600;
        z-index: 999999;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        gap: 10px;
        border: none;
        outline: none;
      }
      .bookbot-widget-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 15px 30px rgba(0,0,0,0.2);
        filter: brightness(1.1);
      }
      .bookbot-widget-button:active {
        transform: translateY(0);
      }
      .bookbot-widget-modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.4);
        backdrop-filter: blur(4px);
        z-index: 1000000;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      .bookbot-widget-modal.active {
        display: flex;
        opacity: 1;
      }
      .bookbot-widget-iframe-container {
        width: 95%;
        max-width: 550px;
        height: 90%;
        max-height: 750px;
        position: relative;
        transform: scale(0.95);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .bookbot-widget-modal.active .bookbot-widget-iframe-container {
        transform: scale(1);
      }
      .bookbot-widget-iframe {
        width: 100%;
        height: 100%;
        border: none;
        border-radius: 24px;
        background: white;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      }
      .bookbot-widget-close {
        position: absolute;
        top: -12px;
        right: -12px;
        background: white;
        border: none;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        color: #64748b;
        z-index: 1;
      }
      .bookbot-widget-close:hover {
        color: #1e293b;
        transform: rotate(90deg);
        transition: transform 0.2s ease;
      }
      @media (max-width: 640px) {
        .bookbot-widget-iframe-container {
          width: 100%;
          height: 100%;
          max-height: none;
        }
        .bookbot-widget-iframe {
          border-radius: 0;
        }
        .bookbot-widget-close {
          top: 16px;
          right: 16px;
        }
      }
    </style>
    <button class="bookbot-widget-button">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      Записаться онлайн
    </button>
  `;
  document.body.appendChild(buttonContainer);
  
  // Создать модальное окно с iframe
  const modal = document.createElement('div');
  modal.className = 'bookbot-widget-modal';
  modal.innerHTML = `
    <div class="bookbot-widget-iframe-container">
      <button class="bookbot-widget-close">×</button>
      <iframe 
        class="bookbot-widget-iframe"
        src="${WIDGET_API}/book/${businessSlug}?widget=true"
        allow="payment"
      ></iframe>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Обработчики
  const btn = buttonContainer.querySelector('.bookbot-widget-button');
  const closeBtn = modal.querySelector('.bookbot-widget-close');
  
  btn.addEventListener('click', () => {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  });
  
  const closeModal = () => {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  };
  
  closeBtn.addEventListener('click', closeModal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  
  // Слушать сообщения из iframe
  window.addEventListener('message', (event) => {
    // В продакшене здесь должна быть проверка event.origin
    if (event.data.type === 'bookbot:booking-complete') {
      setTimeout(closeModal, 3000); // Закрыть через 3 секунды после успеха
    }
  });
})();
