'use strict';

const gulp = require('gulp');
const eslint = require('gulp-eslint');

gulp.task('test', () => {
  const jsFiles = [
    './**/*.js',
    '!./node_modules/**',
    '!./**/node_modules/**'
  ];
  return gulp.src(jsFiles)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});
