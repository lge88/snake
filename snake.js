class Canvas2DRenderer {
  constructor({ canvasId, nx, ny, spacingRatio }) {
    const canvas = document.getElementById(canvasId);
    const { width, height } = canvas;
    const dx = width / nx, dy = height / ny;
    const pixelWidth = dx / (1 + spacingRatio);
    const pixelHeight = dy / (1 + spacingRatio);

    this._dx = dx;
    this._dy = dy;
    this._pixelWidth = pixelWidth;
    this._pixelHeight = pixelHeight;
    this._ctx = canvas.getContext('2d');
  }

  clear() {
    const { width, height } = this._ctx.canvas;
    this._ctx.save();
    this._ctx.clearRect(0, 0, width, height );
    this._ctx.restore();
  }

  drawBanner({ text }) {
    this._ctx.save();
    const { width, height } = this._ctx.canvas;
    const cx = 0.5 * width, cy = 0.5 * height;
    this._ctx.font = '48px serif';
    this._ctx.textAlign = 'center';
    this._ctx.fillText(text, cx, cy);
    this._ctx.restore();
  }

  drawPixel({ x, y, color }) {
    const { _dx: dx, _dy: dy, _pixelWidth: w, _pixelHeight: h } = this;
    const p = { x: x * dx, y: y * dy };
    this._ctx.save();
    this._ctx.fillStyle = color;
    this._ctx.fillRect(p.x, p.y, w, h);
    this._ctx.restore();
    return this;
  }

  drawPixels({ pixels, color }) {
    const { _dx: dx, _dy: dy, _pixelWidth: w, _pixelHeight: h } = this;
    this._ctx.save();
    this._ctx.fillStyle = color;
    pixels.forEach((pixel) => {
      const { x, y } = pixel;
      const p = { x: x * dx, y: y * dy };
      this._ctx.fillRect(p.x, p.y, w, h);
    });
    this._ctx.restore();
    return this;
  }
};

const getLeft = ({ x, y }) => ({ x: x - 1, y });
const getRight = ({ x, y }) => ({ x: x + 1, y });
const getUp = ({ x, y }) => ({ x, y: y - 1 });
const getDown = ({ x, y }) => ({ x, y: y + 1 });

class Snake {
  constructor({ pixels, color, movingDirection }) {
    this.color = color;
    this._pixels = pixels.map(({x, y}) => ({x, y}));
    this._movingDirection = movingDirection;
  }

  pixels() {
    return this._pixels;
  }

  head() {
    const p = this._pixels[0];
    return { x: p.x, y: p.y };
  }

  setDirection(newDirection) {
    const oldDirection = this._movingDirection;
    if ((oldDirection == 'left' && newDirection == 'right') ||
        (oldDirection == 'right' && newDirection == 'left') ||
        (oldDirection == 'up' && newDirection == 'down') ||
        (oldDirection == 'down' && newDirection == 'up')) {
      this._pixels.reverse();
    }
    this._movingDirection = newDirection;
  }

  nextHead() {
    const head = this.head();
    if (this._movingDirection == 'left') return getLeft(head);
    if (this._movingDirection == 'right') return getRight(head);
    if (this._movingDirection == 'up') return getUp(head);
    if (this._movingDirection == 'down') return getDown(head);
    return head;
  }

  move(newHead) {
    this._pixels.unshift(newHead);
    this._pixels.pop();
  }

  eat(food) {
    const { x, y } = food;
    this._pixels.unshift({ x, y });
  }

  wouldHitSelf(newHeadPosition) {
    const { x, y } = newHeadPosition;
    const pixels = this._pixels;
    // Ignore current head, check collision for all other parts
    for (let i = 1, len = pixels.length; i < len; ++i) {
      const p = pixels[i];
      if (x == p.x && y == p.y) return true;
    }
    return false;
  }

  draw(renderer) {
    const { _pixels: pixels, color } = this;
    renderer.drawPixels({ pixels, color });
  }
}

class Food {
  constructor({ x, y, color }) {
    this.x = x;
    this.y = y;
    this.color = color;
  }

  draw(renderer) {
    const { x, y, color } = this;
    renderer.drawPixel({ x, y, color });
  }
}

// Generate a random int in [0, n-1] inclusive
function randomInt(n) {
  return Math.floor(n * Math.random());
}

function randomPick(arr) {
  return arr[randomInt(arr.length)];
}

class Game {
  // configs:
  // cavasId
  // nx
  // ny
  // spacingRatio
  // snakeColor
  // snakeMovingDirection
  // snakePixels
  // foodColor
  // frameInterval
  constructor(config) {
    Object.assign(this, config);

    this.animationId = null;
    this.animate = this.animate.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.update = this.update.bind(this);
    this.render = this.render.bind(this);
    this.pixelToIndex = this.pixelToIndex.bind(this);
    this.indexToPixel = this.indexToPixel.bind(this);
  }

  start() {
    this.stop();

    const { canvasId, nx, ny, spacingRatio } = this;
    const { snakeColor, snakeMovingDirection, snakePixels } = this;
    const { foodColor } = this;

    this.renderer = new Canvas2DRenderer({ canvasId, nx, ny, spacingRatio });

    this.snake = new Snake({
      color: snakeColor,
      movingDirection: snakeMovingDirection,
      pixels: snakePixels
    });

    this.food = this.generateFood();

    this.movingDirection = snakeMovingDirection;
    this.frameCount = 0;
    this.gameState = {
      error: null,
      score: 0
    };

    document.addEventListener('keydown', this.onKeyDown);
    this.animationId = requestAnimationFrame(this.animate);
  }

  stop() {
    cancelAnimationFrame(this.animationId);
    document.removeEventListener('keydown', this.onKeyDown);
  }

  animate(ts) {
    const { frameCount, frameInterval } = this;

    const curFrameCount = Math.floor(ts / frameInterval);
    if (frameCount < 0) return;

    if (curFrameCount > frameCount) {
      this.update();
      this.render();
      this.frameCount = curFrameCount;
    }

    const { error } = this.gameState;
    if (error !== null) return;
    this.animationId = requestAnimationFrame(this.animate);
  }

  onKeyDown(e) {
    // console.log(e);
    switch (e.keyCode) {
    case 37:
    case 65:
      // <- or 'a'
      this.movingDirection = 'left'; break;

    case 39:
    case 68:
      // -> or 'd'
      this.movingDirection = 'right'; break;

    case 38:
    case 87:
      // up arrow or 'w'
      this.movingDirection = 'up'; break;

    case 40:
    case 83:
      // down arrow or 's'
      this.movingDirection = 'down'; break;

    default: break;
    }
    e.stopPropagation();
  }

  update() {
    const { nx, ny } = this;
    const { snake, food, movingDirection } = this;

    snake.setDirection(movingDirection);

    const newHead = snake.nextHead();

    if (snake.wouldHitSelf(newHead) ||
        (newHead.x < 0 || newHead.x >= nx) ||
        (newHead.y < 0 || newHead.y >= ny)) {
      this.gameState.error = 'Game Over!';
      return;
    } else if (food.x == newHead.x && food.y == newHead.y) {
      snake.eat(food);
      this.food = this.generateFood();
    }

    snake.move(newHead);
  }

  pixelToIndex({ x, y }) {
    return y + this.nx + x;
  }

  indexToPixel(i) {
    const nx = this.nx;
    return { x: i % nx, y: Math.floor(i / nx) };
  }

  generateFood() {
    const { nx, ny, snake, foodColor } = this;

    const snakeBodyMap = snake.pixels()
            .map(this.pixelToIndex)
            .reduce((sofar, index) => {
              sofar[index] = true;
              return sofar;
            }, {});

    let availablePositions = [];
    for (let x = 0; x < nx; ++x) {
      for (let y = 0; y < ny; ++y) {
        const p = { x, y };
        const index = this.pixelToIndex(p);
        if (snakeBodyMap[index] !== true) {
          availablePositions.push(p);
        }
      }
    }

    const picked = randomPick(availablePositions);

    return new Food({ x: picked.x, y: picked.y, color: foodColor });
  }

  render() {
    const { renderer, snake, food } = this;
    const { gameState } = this;
    const { error } = gameState;
    if (error !== null) {
      renderer.drawBanner({ text: error });
      return;
    }

    renderer.clear();
    snake.draw(renderer);
    food.draw(renderer);
  }
}

var game = new Game;
game.canvasId = 'canvas';
game.nx = 10;
game.ny = 20;
game.spacingRatio = 0.1;
game.snakeColor = 'blue';
game.foodColor = 'red';
game.snakeMovingDirection = 'down';
game.snakePixels = [
  { x: 1 + randomInt(8), y: 2 + randomInt(16) },
];
game.frameInterval = 200;

game.start();
