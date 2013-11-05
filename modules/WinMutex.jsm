/*
This file is part of Fire-IE.

Fire-IE is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Fire-IE is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with Fire-IE.  If not, see <http://www.gnu.org/licenses/>.
*/

/**
 * @fileOverview Windows system-wide mutex implementation using Win32 API
 */

var EXPORTED_SYMBOLS = ["WinMutex"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/ctypes.jsm");

let DEBUG = 0;

function debug(s) {
  if (DEBUG) {
    dump("-*- WinMutex: " + s + "\n");
  }
}

let CreateMutexW = null;
let WaitForSingleObject = null;
let ReleaseMutex = null;
let CloseHandle = null;

const HANDLE = new ctypes.PointerType(new ctypes.StructType("HANDLE"));
const BOOL = ctypes.int32_t;
const DWORD = ctypes.uint32_t;
const PVOID = ctypes.voidptr_t;
const LPCWSTR = ctypes.jschar.ptr;

// The infinite timeout constant
const INFINITE = 0xFFFFFFFF;

// WaitForSingleObject return values
const WAIT_ABANDONED = 0x80;
const WAIT_OBJECT_0 = 0;
const WAIT_TIMEOUT = 0x102;
const WAIT_FAILED = 0xFFFFFFFF;

const ERROR_ALREADY_EXISTS = 183;

function init() {
  let CallBackABI = ctypes.stdcall_abi;
  let WinABI = ctypes.winapi_abi;
  if (ctypes.size_t.size == 8) {
    CallBackABI = ctypes.default_abi;
    WinABI = ctypes.default_abi;
  }
  let kernel32dll = ctypes.open("kernel32.dll");
  if (!kernel32dll) return;
  CreateMutexW = kernel32dll.declare("CreateMutexW", WinABI, HANDLE, PVOID, BOOL, LPCWSTR);
  ReleaseMutex = kernel32dll.declare("ReleaseMutex", WinABI, BOOL, HANDLE);
  CloseHandle = kernel32dll.declare("CloseHandle", WinABI, BOOL, HANDLE);
}

function WinMutex(mutexName) {
  if (CreateMutexW == null || CloseHandle == null || ReleaseMutex == null) return 'unknown';
  this.name = mutexName;
  let hMutex = CreateMutexW(null, 1, this.name);
  if (!hMutex || ctypes.winLastError == ERROR_ALREADY_EXISTS) {
    if ( !! hMutex) {
      ReleaseMutex(hMutex);
    }
    return 'true';
  }
  ReleaseMutex(hMutex);
  CloseHandle(hMutex);
  return 'false';
}

init();