import { writeFileSync } from 'fs';
export class JsonOutputFormatter {
    async output(stats, outputPath) {
        const jsonData = this.formatStats(stats);
        const jsonString = JSON.stringify(jsonData, null, 2);
        writeFileSync(outputPath, jsonString, 'utf8');
    }
    formatStats(stats) {
        return {
            metadata: {
                generatedAt: new Date().toISOString(),
                tool: 'gha-cache-hit-rate',
                version: '0.1.0',
                repository: {
                    owner: stats.owner,
                    repo: stats.repo,
                    fullName: `${stats.owner}/${stats.repo}`
                },
                analysis: {
                    dateRange: {
                        from: stats.dateRange.from.toISOString(),
                        to: stats.dateRange.to.toISOString(),
                        durationDays: Math.ceil((stats.dateRange.to.getTime() - stats.dateRange.from.getTime()) / (1000 * 60 * 60 * 24))
                    },
                    totalRunsAnalyzed: stats.totalRunsAnalyzed,
                    workflowsWithCacheOps: stats.workflowStats.length
                }
            },
            summary: {
                overall: {
                    totalCacheOperations: stats.totalCacheOps,
                    cacheHits: stats.totalCacheHits,
                    cacheMisses: stats.totalCacheMisses,
                    partialHits: stats.totalPartialHits,
                    hitRate: parseFloat(stats.overallHitRate.toFixed(2)),
                    partialHitRate: parseFloat(stats.overallPartialHitRate.toFixed(2)),
                    effectiveHitRate: parseFloat((stats.overallHitRate + stats.overallPartialHitRate).toFixed(2)),
                    missRate: parseFloat((100 - stats.overallHitRate - stats.overallPartialHitRate).toFixed(2))
                },
                performance: {
                    highPerformers: stats.workflowStats.filter(w => w.hitRate >= 80).length,
                    mediumPerformers: stats.workflowStats.filter(w => w.hitRate >= 50 && w.hitRate < 80).length,
                    lowPerformers: stats.workflowStats.filter(w => w.hitRate < 50).length,
                    averageHitRate: stats.workflowStats.length > 0
                        ? parseFloat((stats.workflowStats.reduce((sum, w) => sum + w.hitRate, 0) / stats.workflowStats.length).toFixed(2))
                        : 0
                },
                cacheEfficiency: {
                    totalTimeSaved: stats.workflowStats
                        .filter(w => w.timeSavedMs)
                        .reduce((sum, w) => sum + (w.timeSavedMs || 0), 0),
                    averageCacheSize: this.calculateAverageCacheSize(stats),
                    workflowsWithTimingData: stats.workflowStats.filter(w => w.timeSavedMs && w.timeSavedMs > 0).length,
                    workflowsWithSizeData: stats.workflowStats.filter(w => w.avgCacheSize && w.avgCacheSize > 0).length
                }
            },
            workflows: stats.workflowStats.map(workflow => ({
                name: workflow.workflowName,
                statistics: {
                    totalCacheOperations: workflow.totalCacheOps,
                    cacheHits: workflow.cacheHits,
                    cacheMisses: workflow.cacheMisses,
                    partialHits: workflow.partialHits,
                    hitRate: parseFloat(workflow.hitRate.toFixed(2)),
                    partialHitRate: parseFloat(workflow.partialHitRate.toFixed(2)),
                    effectiveHitRate: parseFloat((workflow.hitRate + workflow.partialHitRate).toFixed(2)),
                    missRate: parseFloat(((workflow.cacheMisses / workflow.totalCacheOps) * 100).toFixed(2))
                },
                performance: {
                    averageCacheSize: workflow.avgCacheSize || null,
                    timeSaved: workflow.timeSavedMs || null,
                    rating: this.getPerformanceRating(workflow.hitRate),
                    recommendations: this.getWorkflowRecommendations(workflow)
                },
                recentOperations: workflow.recentOperations.map(op => ({
                    runId: op.runId,
                    runDate: op.runDate.toISOString(),
                    jobName: op.jobName,
                    stepName: op.stepName,
                    cacheKey: op.cacheKey,
                    result: {
                        type: op.cacheResultType,
                        isHit: op.isHit,
                        sizeBytes: op.cacheSize || null,
                        timeMs: op.timeMs || null
                    },
                    runUrl: op.runUrl
                }))
            })),
            recommendations: this.generateRecommendations(stats),
            insights: this.generateInsights(stats)
        };
    }
    calculateAverageCacheSize(stats) {
        const workflowsWithSize = stats.workflowStats.filter(w => w.avgCacheSize && w.avgCacheSize > 0);
        if (workflowsWithSize.length === 0) {
            return null;
        }
        const totalSize = workflowsWithSize.reduce((sum, w) => sum + (w.avgCacheSize || 0), 0);
        return parseFloat((totalSize / workflowsWithSize.length).toFixed(0));
    }
    getPerformanceRating(hitRate) {
        if (hitRate >= 80) {
            return 'excellent';
        }
        if (hitRate >= 60) {
            return 'good';
        }
        if (hitRate >= 40) {
            return 'fair';
        }
        if (hitRate >= 20) {
            return 'poor';
        }
        return 'very-poor';
    }
    getWorkflowRecommendations(workflow) {
        const recommendations = [];
        if (workflow.hitRate < 40) {
            recommendations.push('Consider reviewing cache key generation strategy');
            recommendations.push('Implement fallback restore-keys for better partial hit rates');
        }
        if (workflow.partialHitRate > 30) {
            recommendations.push('High partial hit rate indicates frequently changing cache keys');
            recommendations.push('Consider using more stable cache key components');
        }
        if (workflow.totalCacheOps > 50 && workflow.hitRate < 30) {
            recommendations.push('Evaluate custom Docker images as alternative to caching');
        }
        if (workflow.avgCacheSize && workflow.avgCacheSize > 1024 * 1024 * 1024) {
            recommendations.push('Large cache sizes detected - consider cache optimization');
        }
        if (recommendations.length === 0) {
            recommendations.push('Cache performance looks good for this workflow');
        }
        return recommendations;
    }
    generateRecommendations(stats) {
        const recommendations = [];
        if (stats.overallHitRate < 40) {
            recommendations.push({
                priority: 'high',
                category: 'cache-strategy',
                message: 'Overall hit rate is very low. Consider reviewing your caching strategy across all workflows.',
                actionable: true
            });
        }
        const hitRateVariance = this.calculateHitRateVariance(stats.workflowStats);
        if (hitRateVariance > 30) {
            recommendations.push({
                priority: 'medium',
                category: 'consistency',
                message: 'Hit rates vary significantly between workflows. Consider standardizing cache key strategies.',
                actionable: true
            });
        }
        const lowPerformers = stats.workflowStats.filter(w => w.hitRate < 30 && w.totalCacheOps > 20);
        if (lowPerformers.length > stats.workflowStats.length * 0.3) {
            recommendations.push({
                priority: 'high',
                category: 'architecture',
                message: 'Many workflows have poor cache performance. Consider custom Docker images with pre-installed dependencies.',
                actionable: true
            });
        }
        if (stats.overallPartialHitRate > 25) {
            recommendations.push({
                priority: 'medium',
                category: 'cache-keys',
                message: 'High partial hit rate suggests cache keys change frequently. Review key generation logic.',
                actionable: true
            });
        }
        if (stats.overallHitRate >= 70) {
            recommendations.push({
                priority: 'low',
                category: 'maintenance',
                message: 'Excellent cache performance! Monitor regularly to maintain this level.',
                actionable: false
            });
        }
        return recommendations;
    }
    generateInsights(stats) {
        const insights = [];
        const performanceDistribution = {
            excellent: stats.workflowStats.filter(w => w.hitRate >= 80).length,
            good: stats.workflowStats.filter(w => w.hitRate >= 60 && w.hitRate < 80).length,
            fair: stats.workflowStats.filter(w => w.hitRate >= 40 && w.hitRate < 60).length,
            poor: stats.workflowStats.filter(w => w.hitRate < 40).length
        };
        insights.push({
            category: 'performance-distribution',
            insight: `Workflow performance varies: ${performanceDistribution.excellent} excellent, ${performanceDistribution.good} good, ${performanceDistribution.fair} fair, ${performanceDistribution.poor} poor`,
            data: performanceDistribution
        });
        const totalOps = stats.totalCacheOps;
        insights.push({
            category: 'cache-volume',
            insight: `Analyzed ${totalOps} cache operations across ${stats.workflowStats.length} workflows`,
            data: {
                totalOperations: totalOps,
                averageOpsPerWorkflow: stats.workflowStats.length > 0 ? Math.round(totalOps / stats.workflowStats.length) : 0,
                mostActiveWorkflow: stats.workflowStats.reduce((max, w) => w.totalCacheOps > max.totalCacheOps ? w : max, stats.workflowStats[0])?.workflowName || null
            }
        });
        const totalTimeSaved = stats.workflowStats
            .filter(w => w.timeSavedMs)
            .reduce((sum, w) => sum + (w.timeSavedMs || 0), 0);
        if (totalTimeSaved > 0) {
            insights.push({
                category: 'time-savings',
                insight: `Cache hits saved approximately ${Math.round(totalTimeSaved / 1000)} seconds of build time`,
                data: {
                    totalTimeSavedMs: totalTimeSaved,
                    totalTimeSavedSeconds: Math.round(totalTimeSaved / 1000),
                    totalTimeSavedMinutes: Math.round(totalTimeSaved / 60000)
                }
            });
        }
        return insights;
    }
    calculateHitRateVariance(workflows) {
        if (workflows.length < 2) {
            return 0;
        }
        const mean = workflows.reduce((sum, w) => sum + w.hitRate, 0) / workflows.length;
        const variance = workflows.reduce((sum, w) => sum + Math.pow(w.hitRate - mean, 2), 0) / workflows.length;
        return Math.sqrt(variance);
    }
}
