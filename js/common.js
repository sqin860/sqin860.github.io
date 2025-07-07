class CommonLoader {
    static cache = new Map();
    static analyticsQueue = [];
    static isAnalyticsReady = false;
    
    static async loadComponent(elementId, filePath) {
        try {
            // 检查缓存
            let data;
            if (this.cache.has(filePath)) {
                data = this.cache.get(filePath);
            } else {
                const response = await fetch(filePath);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                data = await response.text();
                this.cache.set(filePath, data);
            }
            
            const element = document.getElementById(elementId);
            if (element) {
                element.innerHTML = data;
                // 触发自定义事件，通知组件已加载
                element.dispatchEvent(new CustomEvent('componentLoaded', { 
                    detail: { elementId, filePath } 
                }));
            }
            return true;
        } catch (error) {
            console.error(`Error loading component ${elementId}:`, error);
            this.showError(elementId, `Failed to load ${elementId}`);
            
            // 记录错误到Analytics
            this.trackEvent('error', 'component_load_failed', elementId);
            return false;
        }
    }
    
    static showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <div class="error-message" role="alert">
                    <strong>Error:</strong> ${message}
                    <button onclick="location.reload()" style="margin-left: 10px;">
                        Retry
                    </button>
                </div>
            `;
        }
    }
    
    static async init() {
        // 显示加载状态
        this.showLoadingState();
        
        try {
            // 初始化Analytics
            this.initAnalytics();
            
            // 并行加载组件
            const loadPromises = [
                this.loadComponent('common-header', './common.html'),
                this.loadComponent('common-footer', './footer.html')
            ];
            
            const results = await Promise.allSettled(loadPromises);
            
            // 检查是否有失败的加载
            const failures = results.filter(result => result.status === 'rejected');
            if (failures.length > 0) {
                console.warn('Some components failed to load:', failures);
                this.trackEvent('error', 'component_load_partial_failure', failures.length.toString());
            }
            
            // 初始化其他功能
            await this.initAfterLoad();
            
            // 记录成功初始化
            this.trackEvent('engagement', 'page_init_success', window.location.pathname);
            
        } catch (error) {
            console.error('Failed to initialize common components:', error);
            this.trackEvent('error', 'page_init_failed', error.message);
        } finally {
            this.hideLoadingState();
        }
    }
    
    static initAnalytics() {
        // 检查Analytics是否加载
        const checkAnalytics = () => {
            if (typeof gtag !== 'undefined') {
                this.isAnalyticsReady = true;
                
                // 发送页面视图
                gtag('event', 'page_view', {
                    page_title: document.title,
                    page_location: window.location.href,
                    page_path: window.location.pathname,
                    send_to: 'G-LVJ6791VP4'
                });
                
                // 处理队列中的事件
                this.processAnalyticsQueue();
                
                console.log('Google Analytics initialized successfully');
            } else {
                // 如果GA没有加载，2秒后重试
                setTimeout(checkAnalytics, 2000);
            }
        };
        
        // 立即检查，也设置延迟检查
        checkAnalytics();
        setTimeout(checkAnalytics, 1000);
        
        // 页面可见性变化追踪
        document.addEventListener('visibilitychange', () => {
            this.trackEvent('engagement', document.hidden ? 'page_hide' : 'page_show', '');
        });
        
        // 页面卸载前发送数据
        window.addEventListener('beforeunload', () => {
            this.trackEvent('engagement', 'page_unload', '');
        });
        
        // 页面停留时间追踪
        this.startTimeTracking();
    }
    
    static trackEvent(category, action, label = '', value = null) {
        const eventData = {
            event_category: category,
            event_label: label
        };
        
        if (value !== null) {
            eventData.value = value;
        }
        
        if (this.isAnalyticsReady && typeof gtag !== 'undefined') {
            try {
                gtag('event', action, eventData);
                console.log('Analytics event sent:', category, action, label);
            } catch (error) {
                console.warn('Failed to send analytics event:', error);
                // 添加到队列稍后重试
                this.analyticsQueue.push({ action, data: eventData });
            }
        } else {
            // 如果Analytics还没准备好，加入队列
            this.analyticsQueue.push({ action, data: eventData });
        }
    }
    
    static processAnalyticsQueue() {
        while (this.analyticsQueue.length > 0) {
            const { action, data } = this.analyticsQueue.shift();
            try {
                gtag('event', action, data);
            } catch (error) {
                console.warn('Failed to process queued analytics event:', error);
            }
        }
    }
    
    static startTimeTracking() {
        const startTime = Date.now();
        
        // 每30秒发送一次心跳
        const heartbeatInterval = setInterval(() => {
            const timeSpent = Math.floor((Date.now() - startTime) / 1000);
            this.trackEvent('engagement', 'heartbeat', window.location.pathname, timeSpent);
        }, 30000);
        
        // 页面卸载时清理
        window.addEventListener('beforeunload', () => {
            clearInterval(heartbeatInterval);
            const totalTime = Math.floor((Date.now() - startTime) / 1000);
            this.trackEvent('engagement', 'session_duration', window.location.pathname, totalTime);
        });
    }
    
    static showLoadingState() {
        document.body.classList.add('loading');
    }
    
    static hideLoadingState() {
        document.body.classList.remove('loading');
    }
    
    static async initAfterLoad() {
        // 等待DOM更新
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 初始化Tab导航
        this.initTabNavigation();
        
        // 初始化图片懒加载
        this.initLazyLoading();
        
        // 初始化滚动追踪
        this.initScrollTracking();
    }
    
    static initTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-button');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                if (button.tagName === 'BUTTON') {
                    e.preventDefault();
                    return;
                }
                
                // 追踪导航点击
                this.trackEvent('navigation', 'tab_click', button.textContent.trim());
            });
        });
    }
    
    static initScrollTracking() {
        let maxScroll = 0;
        let scrollMilestones = [25, 50, 75, 90];
        let trackedMilestones = new Set();
        
        const trackScroll = () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercentage = Math.round((scrollTop / documentHeight) * 100);
            
            maxScroll = Math.max(maxScroll, scrollPercentage);
            
            // 追踪滚动里程碑
            scrollMilestones.forEach(milestone => {
                if (scrollPercentage >= milestone && !trackedMilestones.has(milestone)) {
                    trackedMilestones.add(milestone);
                    this.trackEvent('engagement', 'scroll_depth', `${milestone}%`, milestone);
                }
            });
        };
        
        // 节流处理滚动事件
        let scrollTimer;
        window.addEventListener('scroll', () => {
            if (scrollTimer) clearTimeout(scrollTimer);
            scrollTimer = setTimeout(trackScroll, 250);
        });
    }
    
    static initLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        imageObserver.unobserve(img);
                        
                        // 追踪图片加载
                        this.trackEvent('performance', 'image_lazy_loaded', img.dataset.src || img.src);
                    }
                });
            });
            
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CommonLoader.init());
} else {
    CommonLoader.init();
}

// 处理网络连接状态变化
window.addEventListener('online', () => {
    CommonLoader.trackEvent('technical', 'connection_restored', '');
});

window.addEventListener('offline', () => {
    CommonLoader.trackEvent('technical', 'connection_lost', '');
});