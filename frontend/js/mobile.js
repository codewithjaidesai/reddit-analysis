/* Mobile-First UI Enhancements */
(function() {
    'use strict';

    const MOBILE_BREAKPOINT = 768;

    function isMobile() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    /* ---- Bottom Nav Sync ---- */
    window.mobileNavSwitch = function(tab) {
        // Delegate to existing switchTab
        if (typeof switchTab === 'function') {
            switchTab(tab);
        }
        syncBottomNav(tab);
    };

    function syncBottomNav(activeTab) {
        const nav = document.getElementById('mobileBottomNav');
        if (!nav) return;
        nav.querySelectorAll('.mobile-nav-btn').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.tab === activeTab);
        });
    }

    // Patch existing switchTab to keep bottom nav in sync
    var _origSwitchTab = window.switchTab;
    if (_origSwitchTab) {
        window.switchTab = function(tab) {
            _origSwitchTab(tab);
            syncBottomNav(tab);
        };
    }

    /* ---- Bottom Sheet Behavior for Modals ---- */
    function applyBottomSheetBehavior() {
        if (!isMobile()) return;

        var modals = document.querySelectorAll('.reanalyze-modal, .generate-modal');
        modals.forEach(function(modal) {
            var content = modal.querySelector('.reanalyze-modal-content, .generate-modal-content');
            if (!content) return;

            // Touch-based swipe-to-dismiss
            var startY = 0;
            var currentY = 0;

            content.addEventListener('touchstart', function(e) {
                if (content.scrollTop > 0) return; // Only allow swipe when scrolled to top
                startY = e.touches[0].clientY;
            }, { passive: true });

            content.addEventListener('touchmove', function(e) {
                if (content.scrollTop > 0) return;
                currentY = e.touches[0].clientY;
                var diff = currentY - startY;
                if (diff > 0) {
                    content.style.transform = 'translateY(' + diff + 'px)';
                }
            }, { passive: true });

            content.addEventListener('touchend', function() {
                var diff = currentY - startY;
                if (diff > 100) {
                    // Dismiss
                    content.style.transform = '';
                    if (modal.classList.contains('reanalyze-modal') && typeof closeReanalyzeModal === 'function') {
                        closeReanalyzeModal();
                    } else if (typeof closeGenerateModal === 'function') {
                        closeGenerateModal();
                    }
                } else {
                    content.style.transform = '';
                }
                startY = 0;
                currentY = 0;
            }, { passive: true });
        });
    }

    /* ---- Init on DOM ready ---- */
    function init() {
        applyBottomSheetBehavior();

        // Re-apply on resize crossing breakpoint
        var wasMobile = isMobile();
        window.addEventListener('resize', function() {
            var nowMobile = isMobile();
            if (nowMobile && !wasMobile) {
                applyBottomSheetBehavior();
            }
            wasMobile = nowMobile;
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
