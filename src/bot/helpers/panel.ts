import io from 'socket.io';
import https from 'https';
import http, { Server } from 'http';
import express from 'express';
import fs from 'fs';

import type { IconName } from '@fortawesome/free-solid-svg-icons';
import Module from '../_interface';
import { info } from './log';
import { normalize } from 'path';

export const menu: { category: string; name: string; id: string; this: Module | null }[] = [];
export const menuPublic: { name: string; id: string }[] = [];
export const widgets: { id: string; name: string; icon: string }[] = [];

export let ioServer: io.Server | null = null;
export let app: express.Application | null = null;
export let server: Server;
export let serverSecure: Server;

export const addMenu = (menuArg: typeof menu[number]) => {
  if (!menu.find(o => o.id === menuArg.id)) {
    menu.push(menuArg);
  }
};

export const addMenuPublic = (menuArg: typeof menuPublic[number]) => {
  if (!menuPublic.find(o => o.id === menuArg.id)) {
    menuPublic.push(menuArg);
  }
};

export const addWidget = (id: string, name: string, icon: IconName) => {
  widgets.push({ id: id, name: name, icon: icon });
};

export const setApp = (_app: express.Application) => {
  app = _app;
};

export const setServer = () => {
  if (app) {
    server = http.createServer(app);
    ioServer = io(server);
    ioServer.sockets.setMaxListeners(200);

    if (process.env.CA_CERT && process.env.CA_KEY) {
      info(`Using ${process.env.CA_CERT} certificate for HTTPS`);
      serverSecure = https.createServer({
        key: fs.readFileSync(normalize(process.env.CA_KEY)),
        cert: fs.readFileSync(normalize(process.env.CA_CERT)),
      }, app);
      if (ioServer) {
        ioServer.attach(serverSecure);
      }
    } else {
      info(`No certificates were provided, serving only HTTP.`);
    }
  }
};

