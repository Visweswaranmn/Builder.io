import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as projectService from '../services/project.service.js';

export const listProjects = asyncHandler(async (req: Request, res: Response) => {
  const { projects, meta } = await projectService.listProjects(req.validatedQuery ?? {});
  res.json({ success: true, data: { projects, meta } });
});

export const getProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.getProjectById(req.params.id);
  res.json({ success: true, data: { project } });
});

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.createProject(req.body);
  res.status(201).json({ success: true, message: 'Project created', data: { project } });
});

export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.updateProject(req.params.id, req.body);
  res.json({ success: true, message: 'Project updated', data: { project } });
});

export const deleteProject = asyncHandler(async (req: Request, res: Response) => {
  await projectService.deleteProject(req.params.id);
  res.json({ success: true, message: 'Project deleted' });
});
