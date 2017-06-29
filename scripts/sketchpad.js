//    The MIT License (MIT)
//
//    Copyright (c) 2014-2016 YIOM
//
//    Permission is hereby granted, free of charge, to any person obtaining a copy
//    of this software and associated documentation files (the "Software"), to deal
//    in the Software without restriction, including without limitation the rights
//    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//    copies of the Software, and to permit persons to whom the Software is
//    furnished to do so, subject to the following conditions:
//
//    The above copyright notice and this permission notice shall be included in
//    all copies or substantial portions of the Software.
//
//    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//    THE SOFTWARE.

function Sketchpad(config) {
  // Enforces the context for all functions
  for (var key in this.constructor.prototype) {
    this[key] = this[key].bind(this);
  }

  // Warn the user if no DOM element was selected
  if (!config.hasOwnProperty('element')) {
    console.error('SKETCHPAD ERROR: No element selected');
    return;
  }

  if (typeof (config.element) === 'string') {
    this.element = $(config.element);
  } else {
    this.element = config.element;
  }

  if (typeof CanvasRenderingContext2D == 'undefined') {
    Console.log("Script floodfill.js not found!\nConsider using https://github.com/binarymax/floodfill.js")
  }

  // Width can be defined on the HTML or programatically
  this._width = config.width || this.element.attr('data-width') || 0;
  this._height = config.height || this.element.attr('data-height') || 0;

  this._bgColor = config.bgColor || this.element.attr('data-bgcolor') || '#ffffff';

  // Pen attributes
  this.color = config.color || this.element.attr('data-color') || '#000000';
  this.penSize = config.penSize || this.element.attr('data-penSize') || 4;

  // ReadOnly sketchpads may not be modified
  this.readOnly = config.readOnly ||
    this.element.attr('data-readOnly') ||
    false;
  if (!this.readOnly) {
    this.element.css({ cursor: 'crosshair' });
  }

  var loadedStrokes;
  if (config.loadFromStorage
    && typeof (Storage) !== "undefined"
    && localStorage.sketchpad != undefined) {
    loadedStrokes = JSON.parse(localStorage.sketchpad).strokes;
  }

  // Stroke control variables
  this.strokes = config.strokes || loadedStrokes || [];
  this._currentStroke = {
    color: null,
    size: null,
    lines: [],
  };

  this.saveToStorage = (config.saveToStorage && typeof (Storage) != "undefined") || false;

  // Undo History
  this.undoHistory = config.undoHistory || [];

  // Animation function calls
  this.animateIds = [];

  // Set sketching state
  this._sketching = false;
  this._fillmode = false;

  // Setup canvas sketching listeners
  this.reset();
}

//
// Private API
//

Sketchpad.prototype._cursorPosition = function (event) {
  return {
    x: event.pageX - $(this.canvas).offset().left,
    y: event.pageY - $(this.canvas).offset().top,
  };
};

Sketchpad.prototype._draw = function (start, end, color, size) {
  this._stroke(start, end, color, size, 'source-over');
};

Sketchpad.prototype._erase = function (start, end, color, size) {
  this._stroke(start, end, color, size, 'destination-out');
};

Sketchpad.prototype._drawBackground = function () {
  this.context.save();
  this.context.rect(0, 0, this._width, this._height);
  this.context.fillStyle = this._bgColor;
  this.context.fill();

  this.context.restore();
}

Sketchpad.prototype._stroke = function (start, end, color, size, compositeOperation) {
  this.context.save();
  this.context.lineJoin = 'round';
  this.context.lineCap = 'round';
  this.context.strokeStyle = color;
  this.context.lineWidth = size;
  this.context.globalCompositeOperation = compositeOperation;
  this.context.beginPath();
  this.context.moveTo(start.x, start.y);
  this.context.lineTo(end.x, end.y);
  this.context.closePath();
  this.context.stroke();

  this.context.restore();
};

Sketchpad.prototype._fill = function (point, color) {
  this.context.save();
  this.context.fillStyle = color;
  this.context.fillFlood(point.x, point.y);

  this.context.restore();
}

//
// Callback Handlers
//

Sketchpad.prototype._mouseDown = function (event) {
  if (!this._fillmode) {
    this._lastPosition = this._cursorPosition(event);
    this._currentStroke.color = this.color;
    this._currentStroke.size = this.penSize;
    this._currentStroke.lines = [];
  }
  this._sketching = true;
  this.canvas.addEventListener('mousemove', this._mouseMove);
};

Sketchpad.prototype._mouseUp = function (event) {
  if (this._sketching) {
    if (!this._fillmode) {
      this.strokes.push($.extend(true, {}, this._currentStroke));
    } else {
      this._fill(this._cursorPosition(event), this.color);
      this.strokes.push($.extend(true, {}, { point: this._cursorPosition(event), color: this.color }));
    }
    this._sketching = false;
    this.canvas.removeEventListener('mousemove', this._mouseMove);
  }
  if (this.saveToStorage) {
    localStorage.setItem("sketchpad", this.toJSON());
  }
};

Sketchpad.prototype._mouseMove = function (event) {
  var currentPosition = this._cursorPosition(event);
  if (!this._fillmode) {
    this._draw(this._lastPosition, currentPosition, this.color, this.penSize);
    this._currentStroke.lines.push({
      start: $.extend(true, {}, this._lastPosition),
      end: $.extend(true, {}, currentPosition),
    });
  }
  this._lastPosition = currentPosition;
};

Sketchpad.prototype._touchStart = function (event) {
  event.preventDefault();
  if (this._sketching) {
    return;
  }
  this._lastPosition = this._cursorPosition(event.changedTouches[0]);
  this._currentStroke.color = this.color;
  this._currentStroke.size = this.penSize;
  this._currentStroke.lines = [];
  this._sketching = true;
  this.canvas.addEventListener('touchmove', this._touchMove, false);
};

Sketchpad.prototype._touchEnd = function (event) {
  event.preventDefault();
  if (this._sketching) {
    this.strokes.push($.extend(true, {}, this._currentStroke));
    this._sketching = false;
  }
  this.canvas.removeEventListener('touchmove', this._touchMove);
};

Sketchpad.prototype._touchCancel = function (event) {
  event.preventDefault();
  if (this._sketching) {
    this.strokes.push($.extend(true, {}, this._currentStroke));
    this._sketching = false;
  }
  this.canvas.removeEventListener('touchmove', this._touchMove);
};

Sketchpad.prototype._touchLeave = function (event) {
  event.preventDefault();
  if (this._sketching) {
    this.strokes.push($.extend(true, {}, this._currentStroke));
    this._sketching = false;
  }
  this.canvas.removeEventListener('touchmove', this._touchMove);
};

Sketchpad.prototype._touchMove = function (event) {
  event.preventDefault();
  var currentPosition = this._cursorPosition(event.changedTouches[0]);

  this._draw(this._lastPosition, currentPosition, this.color, this.penSize);
  this._currentStroke.lines.push({
    start: $.extend(true, {}, this._lastPosition),
    end: $.extend(true, {}, currentPosition),
  });

  this._lastPosition = currentPosition;
};

Sketchpad.prototype._keyDown = function (event) {
  if (event.keyCode == 90 && event.ctrlKey) {
    this.undo();
  }
};

//
// Public API
//

Sketchpad.prototype.reset = function () {
  // Set attributes
  this.canvas = this.element[0];
  this.canvas.width = this._width;
  this.canvas.height = this._height;
  this.context = this.canvas.getContext('2d');

  // Setup event listeners
  this.redraw(this.strokes);

  if (this.readOnly) {
    return;
  }

  // Mouse
  this.canvas.addEventListener('mousedown', this._mouseDown);
  this.canvas.addEventListener('mouseout', this._mouseUp);
  this.canvas.addEventListener('mouseup', this._mouseUp);

  // Touch
  this.canvas.addEventListener('touchstart', this._touchStart);
  this.canvas.addEventListener('touchend', this._touchEnd);
  this.canvas.addEventListener('touchcancel', this._touchCancel);
  this.canvas.addEventListener('touchleave', this._touchLeave);

  document.addEventListener('keydown', this._keyDown);
};

Sketchpad.prototype.drawStroke = function (stroke) {
  for (var j = 0; j < stroke.lines.length; j++) {
    var line = stroke.lines[j];
    this._draw(line.start, line.end, stroke.color, stroke.size);
  }
};

Sketchpad.prototype.doFill = function (fill) {
  this._fill(fill.point, fill.color)
};

Sketchpad.prototype.redraw = function (strokes) {
  this.clear();

  for (var i = 0; i < strokes.length; i++) {
    if (!!strokes[i].lines)
      this.drawStroke(strokes[i]);
    else
      this.doFill(strokes[i])
  }
};

Sketchpad.prototype.toObject = function () {
  return {
    width: this.canvas.width,
    height: this.canvas.height,
    strokes: this.strokes,
    undoHistory: this.undoHistory,
  };
};

Sketchpad.prototype.toJSON = function () {
  return JSON.stringify(this.toObject());
};

Sketchpad.prototype.animate = function (ms, loop, loopDelay) {
  this.clear();
  var delay = ms;
  var callback = null;
  for (var i = 0; i < this.strokes.length; i++) {
    var stroke = this.strokes[i];
    for (var j = 0; j < stroke.lines.length; j++) {
      var line = stroke.lines[j];
      callback = this._draw.bind(this, line.start, line.end,
        stroke.color, stroke.size);
      this.animateIds.push(setTimeout(callback, delay));
      delay += ms;
    }
  }
  if (loop) {
    loopDelay = loopDelay || 0;
    callback = this.animate.bind(this, ms, loop, loopDelay);
    this.animateIds.push(setTimeout(callback, delay + loopDelay));
  }
};

Sketchpad.prototype.cancelAnimation = function () {
  for (var i = 0; i < this.animateIds.length; i++) {
    clearTimeout(this.animateIds[i]);
  }
  this.redraw(this.strokes);
};

Sketchpad.prototype.clear = function () {
  this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  this._drawBackground();
};

Sketchpad.prototype.new = function () {
  this.clear();
  this.undoHistory = [];
  this.strokes = [];
  if (this.saveToStorage) {
    localStorage.setItem("sketchpad", this.toJSON());
  }
};

Sketchpad.prototype.undo = function () {
  if (stroke = this.strokes.pop()) {
    this.clear();
    this.undoHistory.push(stroke);
    this.redraw(this.strokes);
  }
};

Sketchpad.prototype.redo = function () {
  var stroke = this.undoHistory.pop();
  if (stroke) {
    this.strokes.push(stroke);
    this.drawStroke(stroke);
  }
};

Sketchpad.prototype.clear_sketch = function () {
  this.strokes = [];
  this.undoHistory = [];
  this._drawBackground();
};

Sketchpad.prototype.toggleFill = function () {
  this._fillmode = !this._fillmode;
  if (this._fillmode) {
    this.element.css({ cursor: 'pointer' });
  } else {
    this.element.css({ cursor: 'crosshair' });
  }
};
