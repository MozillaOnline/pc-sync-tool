/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/*
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
*/
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
var DataPool = function(options) {
  this.initailize(options);
  this.DEFAULT_INDEX = '__DEF_INDEX__';
};

DataPool.prototype = {
  initailize: function(options) {
    this.options = extend({
      dataList: null,
      dataKeyGenerator: null,
      dataSorter: null,
      dataIndexGenerator: null,
      groupDataSorter: null,
      groupKeyGenerator: null,
      groupSorter:null
    }, options);
/*
    if (!this.options.dataList || !this.options.dataIndexer || (!this.options.renderFunc && !this.options.renderGroupFunc)) {
      throw new Error('Init arguments are not complete.');
    }*/
  },

  _getGroupPosition: function dp_getGroupPosition(index) {
    for (var i = 0; i < this._groupedData.length; i++) {
      if (String(this._groupedData[i].index) === String(index)) {
        return i;
      }
    }
    return -1;
  },

  getGroupByIndexer: function dp_getGroup(index) {
    var position = this._getGroupPosition(index);
    if (position < 0) {
      return null;
    }

    return this._groupedData[position];
  },

  addToGroup: function dp_addToGroup(dataObj) {
    var index = this.options.groupIndexer(dataObj);
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

  _dataKeyGenerator: function dp_dataKeyGenerator() {
    for (var i = 0; i < this.options.dataList.length; i++) {
      this.options.dataList[i].key = this.options.dataKeyGenerator(this.options.dataList[i]);
    }
  },

  _sortData: function dp_sortData() {
    this.options.dataList.sort(this.options.dataSorter);
  },

  _sortGroupData: function dp_sortData(group) {
    group.dataList.sort(this.options.groupDataSorter);
  },

  _groupData: function dp_groupData() {
    this._groupedData = [];
    var self = this;
    this.options.dataList.forEach(function(dataObj) {
      self._addToGroup(dataObj);
    });
  },

  _getGroup: function dp_getGroup(index) {
    var position = this._getGroupPosition(index);
    if (position < 0) {
      return null;
    }

    return this._groupedData[position];
  },

  _getGroupPosition: function dp_getGroupPosition(index) {
    for (var i = 0; i < this._groupedData.length; i++) {
      if (String(this._groupedData[i].index) === String(index)) {
        return i;
      }
    }
    return -1;
  },

  _addToGroup: function dp_addToGroup(dataObj) {
    var index = this.options.dataIndexGenerator(dataObj);
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

  _groupKeyGenerator: function dp_groupKeyGenerator() {
    for (var i = 0; i < this._groupedData.length; i++) {
      this.options.groupKeyGenerator(this._groupedData[i]);
    }
  },

  _sortGroup: function dp_sortGroup() {
    this._groupedData.sort(this.options.groupSorter);
  },

  getGroupedData: function dp_getGroupedData() {
    return this._groupedData;
  },

  removeGroupByIndex: function gl_removeGroupByIndex(index) {
    var position = this._getGroupPosition(index);
    if (position >= 0) {
      this._groupedData.splice(position,1);
    }
  },

  add: function gl_add(message) {
    message.key = this.options.dataKeyGenerator(message);
    this.options.dataList.push(message);
    this._sortData();
    var group = this._addToGroup(message);
    this._sortGroupData(group);
    this.options.groupKeyGenerator(group);
    this._sortGroup();
  },

  process: function dp_process() {
    this._dataKeyGenerator();
    this._sortData();
    this._groupData();
    this._groupKeyGenerator();
    this._sortGroup();
  }
};


