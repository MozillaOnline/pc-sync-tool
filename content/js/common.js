/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function $id(id) {
  return document.getElementById(id);
}

function $expr(expr, elem) {
  elem = elem ? elem : document;
  var nodeList = elem.querySelectorAll(expr);
  var size = nodeList.length;
  var list = [];

  for (var i = 0; i < size; i++) {
    list.push(nodeList[i]);
  }

  return list;
}

/**
 * Get l10n
 */
function _(key, args, fallback) {
  return navigator.mozL10n.get(key, args, fallback);
}

(function() {
  function extend(destination, source) {
    for (var property in source)
      destination[property] = source[property];
    return destination;
  }

  extend(window, {
    extend: extend
  });
})();

function emptyFunction() {

}

function log(msg) {
  console.log(msg);
}

/**
 * Execute the async functions
 * The functions must call the given callback functions when executed.
 */
function syncExecuteAsyncFuncs(asyncFuncs, onFinished) {
  if (asyncFuncs.length == 0) {
    onFinished();
  }

  function execAsyncFunc(func) {
    func(function async_callback() {
      if (asyncFuncs.length > 0) {
        execAsyncFunc(asyncFuncs.shift());
      } else {
        onFinished();
      }
    });
  }

  execAsyncFuncs(asyncFuncs.shift());
}

function removeFromArray(objOrFunc, array) {
  var newArray = [];

  array.forEach(function(i) {
    if (typeof objOrFunc === 'function' && objOrFunc(i)) {
      return;
    } else if (i === objOrFunc) {
      return;
    }
    newArray.push(i);
  });

  return newArray;
}

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
      container: document.body
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
      if (this._groupedData[i].index === index) {
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
  },

  getGroupedData: function gl_getGroupedData() {
    return this._groupedData;
  }
};

/**
 * Return the index character of the given string in lowercase.
 * Usually, the first character will be returned.
 *
 * TODO handle chinese character
 */
function getIndexCharacter(str) {
  if (!str || str.length == 0) {
    return null;
  }

  for (var i = 0; i < str.length; i++) {
    var c = str.charAt(i).toLowerCase();
    if (c >= 'a' && c <= 'z') {
      return c;
    }
  }

  return null;
}

/**
 * Group contacts by name ASC
 *
 * Return:
 * [{
 *   a
 * }]
 */
function ascGroupContacts() {

}

