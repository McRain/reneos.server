import http from 'http'
import fs from'fs'
import path from 'path'

const server = http.createServer((req, res) => {
  // Путь к статическим файлам
  const staticPath = path.join("./", 'www');

  // Получаем путь к запрашиваемому файлу
  let filePath = path.join(staticPath, req.url);

  if (filePath.charAt(filePath.length - 1) === path.sep) {
    filePath = path.join(filePath, 'index.html');
  }

  // Читаем файл из системы
  fs.readFile(filePath, (err, data) => {
    console.log(filePath)
    if (err) {
      // Если произошла ошибка (например, файл не найден), отправляем 404
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    } else {
      // Устанавливаем заголовки ответа
      res.writeHead(200, { 'Content-Type': getContentType(filePath) });
      // Отправляем содержимое файла
      res.end(data);
    }
  });
});

// Запускаем сервер на порту 3000
const port = 80;
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});

// Функция для определения Content-Type на основе расширения файла
function getContentType(filePath) {
  const extname = path.extname(filePath);
  switch (extname) {
    case '.html':
      return 'text/html';
    case '.css':
      return 'text/css';
    case '.js':
      return 'text/javascript';
    case '.png':
      return 'image/png';
    case '.jpg':
      return 'image/jpg';
    default:
      return 'text/plain';
  }
}