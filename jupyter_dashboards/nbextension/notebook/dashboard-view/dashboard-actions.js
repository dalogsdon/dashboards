/**
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */
/**
 * This module handles dashboard-view menu and toolbar creation and actions.
 */
define([
    'require',
    'jquery',
    'base/js/namespace',
    'text!./sub-menu.html',
    'text!./view-menu.html'
], function(
    require,
    $,
    IPython,
    subMenuTemplate,
    viewMenuTemplate
) {
    'use strict';

    var STATE = {
        NOTEBOOK: 'nb',
        DASHBOARD_AUTH_GRID: 'db-auth-grid',
        DASHBOARD_AUTH_REPORT: 'db-auth-report',
        DASHBOARD_VIEW: 'db-view'
    };
    var currentState = STATE.NOTEBOOK;
    var dbViewToolbarBtnsId = 'urth-dashboard-view-toolbar-buttons';
    var scrollToBottom;
    var opts;
    var isHeaderVisible = true;
    var isToolbarVisible = true;
    var toolbarBtns = [
        {
            help: 'Notebook view. Edit the code.',
            icon: 'fa-code',
            state: STATE.NOTEBOOK
        },
        {
            help: 'Dashboard Grid Layout. Size and position dashboard cells in a grid.',
            icon: 'fa-th-large',
            state: STATE.DASHBOARD_AUTH_GRID
        },
        {
            help: 'Dashboard Report Layout. Display dashboard cells in a list.',
            icon: 'fa-bars',
            state: STATE.DASHBOARD_AUTH_REPORT
        },
        {
            help: 'Dashboard Preview. Preview the dashboard.',
            icon: 'fa-dashboard',
            state: STATE.DASHBOARD_VIEW
        }
    ];

    function setStateFromQueryString() {
        // set 'Dashboard View' state if 'dashboard' query parameter is set
        var idx = window.location.search.slice(1).split(/[&=]/).indexOf('dashboard');
        if (idx !== -1) {
            setDashboardState(STATE.DASHBOARD_VIEW);
        }
    }

    function setDashboardState(newState) {
        if (newState === currentState) {
            // no state change; ignore
            return;
        }

        switch (newState) {
            case STATE.NOTEBOOK:
                exitDashboardMode();
                break;
            case STATE.DASHBOARD_AUTH_GRID:
            case STATE.DASHBOARD_AUTH_REPORT:
                enterDashboardMode(newState, currentState /* prev state */);
                break;
        }

        setViewButtonPressed(newState);
        currentState = newState;
    }

    function exitDashboardMode() {
        // Revert changes done in enterDashboardMode()
        $('body').removeClass('view-only');
        $('#urth-notebook-view').addClass('selected');
        $('#urth-dashboard-auth, #urth-dashboard-view').removeClass('selected');
        $('#urth-dashboard-show-all, #urth-dashboard-show-all-stacked, #urth-dashboard-hide-all').addClass('disabled');
        opts.exitDbModeCallback();
        updateUrlState(false);
        setHeaderVisibility(true); // enable header and toolbar
        setCodeMirrorEnabled(true);

        // restore scrolling behavior
        IPython.Notebook.prototype.scroll_to_bottom = scrollToBottom;
        scrollToBottom = null;
    }

    function enterDashboardMode(newState, prevState) {
        // Add a class to the document body so our styles can take effect
        $('body').toggleClass('view-only', newState === STATE.DASHBOARD_VIEW);

        // style menus according to state
        $('#urth-dashboard-show-all, #urth-dashboard-show-all-stacked, #urth-dashboard-hide-all').toggleClass('disabled', newState === STATE.DASHBOARD_VIEW);
        $('#view_menu [data-db-state]').each(function() {
            $(this).toggleClass('selected', newState === $(this).attr('data-db-state'));
        });

        setHeaderVisibility(newState !== STATE.DASHBOARD_VIEW);
        setCodeMirrorEnabled(false);
        opts.enterDbModeCallback(
            newState !== STATE.DASHBOARD_VIEW, // doEnableGrid
            newState === STATE.DASHBOARD_AUTH_REPORT ? 1 : 12 // numCols
        );
        updateUrlState(newState === STATE.DASHBOARD_VIEW);

        // disable scroll to bottom of notebook
        scrollToBottom = IPython.Notebook.prototype.scroll_to_bottom;
        IPython.Notebook.prototype.scroll_to_bottom = function() {};
    }

    function setViewButtonPressed(state) {
        $('#' + dbViewToolbarBtnsId + ' > button[data-jupyter-action="urth.' + state + '"]')
            .addClass('active')
            .siblings().removeClass('active');
    }

    function setHeaderVisibility(doShow) {
        // if hiding, save current state
        if (!doShow) {
            isHeaderVisible = $('#header-container').is(':visible');
            isToolbarVisible = $('div#maintoolbar').is(':visible');
        }
        // hide or revert back to previous saved state
        $('#header-container').toggle(doShow && isHeaderVisible);
        $('.header-bar').toggle(doShow && isHeaderVisible);
        $('div#maintoolbar').toggle(doShow && isToolbarVisible);
        // make sure notebook resizes properly
        IPython.notebook.events.trigger('resize-header.Page');
    }

    function updateUrlState(inDashboardViewMode) {
        var l = window.location;
        var s = l.search.slice(1);
        if (inDashboardViewMode) {
            if (s.split(/[&=]/).indexOf('dashboard') === -1) {
                s += (s.length ? '&' : '') + 'dashboard';
            }
        } else {
            var params = s.split('&');
            var idx = params.indexOf('dashboard');
            if (idx !== -1) {
                params.splice(idx, 1);
            }
            s = params.join('&');
        }
        var url = l.protocol + '//' + l.host + l.pathname + (s.length ? '?' + s : '');
        window.history.replaceState(null, null, url);
    }

    // disable editting/focussing of CodeMirror content when in dashboard mode
    function setCodeMirrorEnabled(doEnable) {
        $('.CodeMirror').each(function() {
            this.CodeMirror.setOption('readOnly', doEnable ? false : 'nocursor');
        });
    }

    /*************************************/
    var DashboardActions = function(args) {
        opts = {
            enterDbModeCallback: args.enterDashboardMode,
            exitDbModeCallback: args.exitDashboardMode,
            showAllCallback: args.showAll,
            showAllStackedCallback: args.showAllStacked,
            hideAllCallback: args.hideAll
        };
        setStateFromQueryString();
    };

    DashboardActions.prototype.addMenuItems = function() {
        // Add view menu items and hook up click handlers to set state
        $('#view_menu').append('<li class="divider"/>', viewMenuTemplate);
        $('#view_menu').find('[data-db-state]').click(function() {
            setDashboardState($(this).attr('data-db-state'));
        });

        // initial selected view menu item
        $('#view_menu [data-db-state="' + currentState + '"]').addClass('selected');

        // Cell menu items to show/hide cells
        $('#cell_menu').append('<li class="divider"/>', subMenuTemplate);
        $('#urth-dashboard-show-all').click(opts.showAllCallback);
        $('#urth-dashboard-show-all-stacked').click(opts.showAllStackedCallback);
        $('#urth-dashboard-hide-all').click(opts.showAllStackedCallback);
    };

    DashboardActions.prototype.addToolbarItems = function() {
        // button group to choose dashboard view
        IPython.toolbar.add_buttons_group(toolbarBtns.map(function(btn) {
            return IPython.keyboard_manager.actions.register({
                help: btn.help,
                icon: btn.icon,
                handler: function() { setDashboardState(btn.state); }
            }, btn.state, 'urth');
        }), dbViewToolbarBtnsId);
        $('#' + dbViewToolbarBtnsId)
            .addClass('urth-dashboard-toolbar-buttons')
            .prepend('<span class="navbar-text">View:</span>');

        // set state of the button corresponding to the current view
        setViewButtonPressed(currentState);
    };

    DashboardActions.prototype.switchToNotebook = function() {
        setDashboardState(STATE.NOTEBOOK);
    };

    return DashboardActions;
});
