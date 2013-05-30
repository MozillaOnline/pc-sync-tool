/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var ViewManager = (function () {
  function setTitle(title) {
    if (!title) {
      $id('view-title').textContent = '';
    } else {
      $id('view-title').textContent = ' - ' + title;
    }
  }

  function reset() {
      $expr('#container .item').forEach(function reset_func(elem) {
      var viewId = elem.dataset.linkedView;
      if (!viewId) {
        return;
      }

      var linkedView = $id(viewId);
      if (!linkedView) {
        return;
      }

      linkedView.dataset.shown = false;
    });
  }

  function showView(viewId) {
    var viewElem = $id(viewId);
    if (!viewElem) {
      return;
    }

    var tabId = viewElem.dataset.linkedTab;
    if (!tabId) {
      return;
    }

    var tabElem = $id(tabId);

    // Hide other radio list
    if (tabElem.parentNode.classList.contains('radio-list')) {
      $expr('#container .radio-list').forEach(function hideList(list) {
        list.hidden = true;
      });
    }

    // unselect selected item
    $expr('#container .selected').forEach(function unselect(elem) {
      elem.classList.remove('selected');
    });

    tabElem.parentNode.hidden = false;
    tabElem.classList.add('selected');

    $expr('#container .content .view').forEach(function hideView(view) {
      view.hidden = true;
    });
    viewElem.hidden = false;

    if (viewElem.dataset.shown != "true") {
      viewElem.dataset.shown = true;
      callEvent('firstshow', viewId);
    }
  }

  /**
   * A card view is view shown inside a normal view
   */
  function showCardView(cardViewId) {
    var cardView = $id(cardViewId);
    if (!cardView) {
      return;
    }

    // Get parent view
    var parentNode = cardView.parentNode;

    // Hide all other sibling card views
    $expr('.card-view', parentNode).forEach(function(cv) {
      if (cv.id == cardViewId) {
        cv.hidden = false;
      } else {
        cv.hidden = true;
      }
    });
  }

  var callbacks = {};

  /**
   * Supported event name:
   *   firstshow
   */
  function addViewEventListener(viewId, name, callback) {
    if (!callbacks[viewId]) {
      callbacks[viewId] = {};
    }

    if (!callbacks[viewId][name]) {
      callbacks[viewId][name] = [];
    }

    callbacks[viewId][name].push(callback);
  }

  function callEvent(name, viewId) {
    console.log('Call event ' + name + ' on ' + viewId);

    if (!callbacks[viewId] || !callbacks[viewId][name]) {
      return;
    }

    callbacks[viewId][name].forEach(function(callback) {
      callback();
    });
  }

  function init() {
    $expr('#container .item').forEach(function add_click_func(elem) {
      var viewId = elem.dataset.linkedView;
      if (!viewId) {
        return;
      }

      var linkedView = $id(viewId);
      if (!linkedView) {
        return;
      }

      // Link content view with tab
      linkedView.dataset.linkedTab = elem.id;
      elem.addEventListener('click', function(event) {
        showView(this.getAttribute('data-linked-view'));
      });
    });
  }

  window.addEventListener('load', function wnd_onload() {
    window.removeEventListener('load', wnd_onload);
    init();
  });

  return {
    // Show the view by the given id, and hide all other sibling views
    reset: reset,
    showView: showView,
    setTitle: setTitle,
    // Show the card view by given id, and hide all other sibling views
    showCardView: showCardView,
    addViewEventListener: addViewEventListener
  };
})();

