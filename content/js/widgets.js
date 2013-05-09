/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Given data list will be grouped like:
 * [{
 *   index: 'A',
 *   dataList: [item1, item2]
 * }, {
 *   index: 'B',
 *   dataList: [item3, item4]
 * }]
 *
 * Options:
 *   - dataList
 *     Data list that will be grouped and rendered.
 *   - dataIndexer
 *     Function to calc the index of given item.
 *   - indexSorter
 *     Function to sort item index. see more in Array.sort
 *   - dataIdentifier
 *     Function to return the identical string which will be used to judge if two object equals
 *   - renderFunc
 *     Function to render html node for the given item, usually, event listeners will be added.
 *   - container
 *     List container
 *   - ondatachange
 *     Function to be invoked if the data is added or removed
 */
var GroupedList = function(options) {
  this.initailize(options);
  this.DEFAULT_INDEX = '__DEF_INDEX__';
};

GroupedList.prototype = {
  initailize: function(options) {
    this.options = extend({
      dataList: null,
      dataIndexer: null,
      indexSorter: this._dictSorter,
      dataIdentifier: this._identifyById,
      indexRender: this._renderIndex,
      renderFunc: null,
      container: document.body,
      ondatachange: function() {}
    }, options);

    if (!this.options.dataList || !this.options.dataIndexer || !this.options.renderFunc) {
      throw new Error('Init arguments are not complete.');
    }
  },

  _dictSorter: function gl_dictSorter(a, b) {
    if (a.index === b.index) {
      return 0;
    } else if (a.index < b.index) {
      return -1;
    }
    return 1;
  },

  _identifyById: function gl_identifyById(dataObj) {
    if (dataObj.id) {
      return dataObj.id;
    } else {
      return dataObj.toString();
    }
  },

  _getGroup: function gl_getGroup(index) {
    var position = this._getGroupPosition(index);
    if (position < 0) {
      return null;
    }

    return this._groupedData[position];
  },

  _getGroupPosition: function gl_getGroupPosition(index) {
    for (var i = 0; i < this._groupedData.length; i++) {
      if (String(this._groupedData[i].index) === String(index)) {
        return i;
      }
    }
    return -1;
  },

  _addToGroup: function gl_addToGroup(dataObj) {
    var index = this.options.dataIndexer(dataObj);
    index = !index ? self.DEFAULT_INDEX : index;

    var group = this._getGroup(index);
    if (!group) {
      group = {};
      group.index = index;
      group.dataList = [];
      this._groupedData.push(group);
    }

    group.dataList.push(dataObj);

    return group;
  },

  /**
   * Remove data object, and return the contained group
   */
  _removeFromGroup: function gl_removeFromGroup(dataObj) {
    var index = this.options.dataIndexer(dataObj);
    index = !index ? self.DEFAULT_INDEX : index;

    var group = this._getGroup(index);
    if (!group) {
      return null;
    }

    var self = this;
    var newDataList = removeFromArray(function(obj) {
      return self.options.dataIdentifier(obj) ===
               self.options.dataIdentifier(dataObj);
    }, group.dataList);

    group.dataList = newDataList;
    // Remove the empty group
    if (newDataList.length === 0) {
      removeFromArray(group, this._groupedData);
    }

    return group;
  },

  _sortGroup: function gl_sortGroup() {
    this._groupedData.sort(this.options.indexSorter);
  },

  _groupDataList: function gl_groupData() {
    this._groupedData = [];

    var self = this;

    this.options.dataList.forEach(function(dataObj) {
      self._addToGroup(dataObj);
    });

    this._sortGroup();
  },

  _renderIndex: function gl_renderIndex(index) {
    var div = document.createElement('div');
    div.className = 'data-index';
    div.textContent = index;
    return div;
  },

  _renderDataList: function gl_render() {
    var self = this;
    this._groupedData.forEach(function(group) {
      var groupElem = self._renderGroup(group);
      self.options.container.appendChild(groupElem);
    });
  },

  _renderGroup: function gl_renderGroup(group) {
    var groupElem = document.createElement('div');
    groupElem.id = this._getGroupElemId(group.index);

    // Render index element
    groupElem.appendChild(this.options.indexRender(group.index));

    var self = this;
    // Render data list
    group.dataList.forEach(function(dataObj) {
      var dataElem = self.options.renderFunc(dataObj);
      dataElem.dataset.dataIdentity = self.options.dataIdentifier(dataObj);
      groupElem.appendChild(dataElem);
    });

    return groupElem;
  },

  _getGroupElemId: function gl_getGroupElemId(index) {
    return 'id-grouped-data-' + index;
  },

  _getGroupElem: function gl_getGroupElem(index) {
    return $id(this._getGroupElemId(index));
  },

  render: function gl_render() {
    this._groupDataList();
    this._renderDataList();
  },

  add: function gl_add(dataObj) {
    var group = this._addToGroup(dataObj);
    this._sortGroup();

    var groupElem = this._getGroupElem(group.index);
    if (groupElem) {
      // TODO sort data elements
      groupElem.appendChild(this.options.renderFunc(dataObj));
      return;
    }

    // If group is newly created, then render the whole group
    groupElem = this._renderGroup(group);
    var position = this._getGroupPosition(group.index);

    if (position == this._groupedData.length - 1) {
      this.options.container.appendChild(groupElem);
    } else {
      var groupAfter = this._groupedData[position + 1];
      this.options.container.insertBefore(groupElem,
        this._getGroupElem(groupAfter.index));
    }

    this.options.ondatachange();
  },

  remove: function gl_remove(dataObj) {
    var group = this._removeFromGroup(dataObj);

    var groupElem = this._getGroupElem(group.index);

    // remove whole group
    if (group.dataList.length === 0) {
      groupElem.parentNode.removeChild(groupElem);
    } else {
      for (var i = 0; i < groupElem.childNodes.length; i++) {
        var child = groupElem.childNodes[i];
        if (child.dataset.dataIdentity === this.options.dataIdentifier(dataObj)) {
          child.parentNode.removeChild(child);
          break;
        }
      }
    }

    this.options.ondatachange();
  },

  getGroupedData: function gl_getGroupedData() {
    return this._groupedData;
  },

  count: function gl_count() {
    var count = 0;

    this.getGroupedData().forEach(function(group) {
      count += group.dataList.length;
    });

    return count;
  }
};

function ModalDialog(options) {
  this.initailize(options);
}

ModalDialog.prototype = {
  initailize: function(options) {
    this.options = extend({
      title: 'Modal Title',
      bodyElement: null,
      bodyText: null,
      cancelable: true,
      onclose: emptyFunction
    }, options);

    if (!this.options.bodyElement && !this.options.bodyText) {
      throw Error('bodyElement or bodyText should be specified');
    }

    this._modalElement = null;
    this._mask = null;
    this._build();
  },

  _build: function() {
    this._mask = document.createElement('div');
    this._mask.className = 'modal-mask';
    document.body.appendChild(this._mask);

    this._modalElement = document.createElement('div');
    this._modalElement.className = 'modal-dialog';
    this._modalElement.innerHTML = '<div class="modal-container">'
      + '  <div class="modal-close-btn" hidden="true">X</div>'
      + '  <div class="modal-title">'
      + this.options.title
      + '   </div>'
      + '   <div class="modal-body">'
      + '   </div>'
      + '</div>';

    var bodyContainer = $expr('.modal-body', this._modalElement)[0];
    if (this.options.bodyElement) {
      bodyContainer.appendChild(this.options.bodyElement);
    } else {
      bodyContainer.textContent = this.options.bodyText;
    }

    var self = this;
    var closeBtn = $expr('.modal-close-btn', this._modalElement)[0];
    if (this.options.cancelable) {
      closeBtn.hidden = false;
      closeBtn.addEventListener('click', this.close.bind(this));

      this._modalElement.addEventListener('mousedown', this.close.bind(this));
      var container = $expr('.modal-container', this._modalElement)[0];
      container.addEventListener('mousedown', function(event) {
        event.stopPropagation();
      }, true);
    } else {
      closeBtn.hidden = true;
    }

    document.body.appendChild(this._modalElement);
    this._adjustModalPosition();

    // Only one modal dialog is shown at a time.
    var self = this;
    this._onModalDialogShown = function(event) {
      // Show a popup dialog at a time.
      if (event.targetElement == self._modalElement) {
        return;
      }

      self.close();
    }
    document.addEventListener('ModalDialog:show', this._onModalDialogShown);

    // Make sure other modal dialog has a chance to close itself.
    this._fireEvent('ModalDialog:show');

    // Tweak modal dialog position when resizing.
    this._onWindowResize = function(event) {
      self._adjustModalPosition();
    };
    window.addEventListener('resize', this._onWindowResize);
  },

  _adjustModalPosition: function() {
    var container = $expr('.modal-container', this._modalElement)[0];
    var documentHeight = document.documentElement.clientHeight;
    var containerHeight = container.clientHeight;
    container.style.top = (documentHeight > containerHeight ?
      (documentHeight - containerHeight) / 2 : 0) + 'px';
  },

  _fireEvent: function(name, data) {
    var evt = document.createEvent('Event');
    evt.initEvent(name, true, true);
    evt.data = data;
    evt.targetElement = this._modalElement;
    document.dispatchEvent(evt);
  },

  close: function() {
    this._mask.parentNode.removeChild(this._mask);
    this._modalElement.parentNode.removeChild(this._modalElement);
    this._mask = null;
    this._modalElement = null;

    document.removeEventListener('ModalDialog:show', this._onModalDialogShown);
    window.removeEventListener('resize', this._onWindowResize)

    this.options.onclose();
  }
};

