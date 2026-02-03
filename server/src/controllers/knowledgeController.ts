import { Request, Response } from 'express';
import { KnowledgeBaseService } from '../services/knowledgeBaseService';
import { ApiResponse } from '../types';
import logger from '../config/logger';

const knowledgeBaseService = new KnowledgeBaseService();

export class KnowledgeController {
  /**
   * Add a single knowledge chunk
   */
  async addChunk(req: Request, res: Response<ApiResponse>) {
    try {
      const { content, category, source, metadata } = req.body;

      const chunkId = await knowledgeBaseService.addChunk({
        content,
        category,
        source,
        metadata,
      });

      res.status(201).json({
        success: true,
        message: 'Knowledge chunk added successfully',
        data: { id: chunkId },
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Failed to add knowledge chunk:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to add knowledge chunk',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  /**
   * Add multiple knowledge chunks in batch
   */
  async addChunks(req: Request, res: Response<ApiResponse>) {
    try {
      const { chunks } = req.body;

      if (!Array.isArray(chunks) || chunks.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Chunks must be a non-empty array',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const chunkIds = await knowledgeBaseService.addChunks(chunks);

      res.status(201).json({
        success: true,
        message: `Successfully added ${chunkIds.length} knowledge chunks`,
        data: {
          added: chunkIds.length,
          failed: chunks.length - chunkIds.length,
          ids: chunkIds,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Failed to add knowledge chunks:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to add knowledge chunks',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  /**
   * Update a knowledge chunk
   */
  async updateChunk(req: Request, res: Response<ApiResponse>) {
    try {
      const { id } = req.params;
      const { content, category, source, metadata } = req.body;

      await knowledgeBaseService.updateChunk(id, {
        content,
        category,
        source,
        metadata,
      });

      res.json({
        success: true,
        message: 'Knowledge chunk updated successfully',
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Failed to update knowledge chunk:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update knowledge chunk',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  /**
   * Delete a knowledge chunk
   */
  async deleteChunk(req: Request, res: Response<ApiResponse>) {
    try {
      const { id } = req.params;

      await knowledgeBaseService.deleteChunk(id);

      res.json({
        success: true,
        message: 'Knowledge chunk deleted successfully',
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Failed to delete knowledge chunk:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to delete knowledge chunk',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  /**
   * Get chunks by category
   */
  async getChunksByCategory(req: Request, res: Response<ApiResponse>) {
    try {
      const { category } = req.params;

      const chunks = await knowledgeBaseService.getChunksByCategory(category);

      res.json({
        success: true,
        message: 'Knowledge chunks retrieved successfully',
        data: chunks,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Failed to get knowledge chunks:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to retrieve knowledge chunks',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  /**
   * Get knowledge base statistics
   */
  async getStats(req: Request, res: Response<ApiResponse>) {
    try {
      const stats = await knowledgeBaseService.getStats();

      res.json({
        success: true,
        message: 'Knowledge base statistics retrieved successfully',
        data: stats,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Failed to get knowledge base stats:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get statistics',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }
}


