import { Endpoints } from '@/core/composables/endpoints';
import { callEndpoint } from '@/core/api/callEndpoint';
import { toQueryString } from '@/core/api/queryString';
import { unwrapApiResponse, unwrapPagedResponse } from '@/core/api/apiResponse';
function withQuery(path, query) {
    return path + (query ? toQueryString(query) : '');
}
export const ScrapingService = {
    async browseSources(query) {
        const response = await callEndpoint({
            ...Endpoints.browseScrapingSources,
            path: withQuery(Endpoints.browseScrapingSources.path, query),
        });
        return unwrapPagedResponse(response);
    },
    async selectSources(query) {
        const response = await callEndpoint({
            ...Endpoints.selectScrapingSources,
            path: withQuery(Endpoints.selectScrapingSources.path, query),
        });
        return unwrapApiResponse(response);
    },
    async createSource(payload) {
        const response = await callEndpoint(Endpoints.createScrapingSource, { body: payload });
        return unwrapApiResponse(response);
    },
    async updateSource(sourceId, payload) {
        await callEndpoint(Endpoints.updateScrapingSource, {
            params: { sourceId },
            body: payload,
        });
    },
    async setSourceActive(sourceId, isActive) {
        await callEndpoint(Endpoints.setScrapingSourceActive, {
            params: { sourceId },
            body: { isActive },
        });
    },
    async deleteSource(sourceId) {
        await callEndpoint(Endpoints.deleteScrapingSource, { params: { sourceId } });
    },
    async browseCredentials(query) {
        const response = await callEndpoint({
            ...Endpoints.browseScrapingCredentials,
            path: withQuery(Endpoints.browseScrapingCredentials.path, query),
        });
        return unwrapPagedResponse(response);
    },
    async createCredential(payload) {
        const response = await callEndpoint(Endpoints.createScrapingCredential, { body: payload });
        return unwrapApiResponse(response);
    },
    async updateCredential(credentialId, payload) {
        await callEndpoint(Endpoints.updateScrapingCredential, {
            params: { credentialId },
            body: payload,
        });
    },
    async rotateCredentialSecret(credentialId, payload) {
        await callEndpoint(Endpoints.rotateScrapingCredentialSecret, { params: { credentialId }, body: payload });
    },
    async setCredentialActive(credentialId, isActive) {
        await callEndpoint(Endpoints.setScrapingCredentialActive, {
            params: { credentialId },
            body: { isActive },
        });
    },
    async deleteCredential(credentialId) {
        await callEndpoint(Endpoints.deleteScrapingCredential, { params: { credentialId } });
    },
    async browseJobs(query) {
        const response = await callEndpoint({
            ...Endpoints.browseScrapingJobs,
            path: withQuery(Endpoints.browseScrapingJobs.path, query),
        });
        return unwrapPagedResponse(response);
    },
    async createJob(payload) {
        const response = await callEndpoint(Endpoints.createScrapingJob, {
            body: payload,
        });
        return unwrapApiResponse(response);
    },
    async startJob(jobId) {
        await callEndpoint(Endpoints.startScrapingJob, { params: { jobId } });
    },
    async completeJob(jobId) {
        await callEndpoint(Endpoints.completeScrapingJob, { params: { jobId } });
    },
    async failJob(jobId, payload) {
        await callEndpoint(Endpoints.failScrapingJob, {
            params: { jobId },
            body: payload,
        });
    },
    async cancelJob(jobId, payload) {
        await callEndpoint(Endpoints.cancelScrapingJob, {
            params: { jobId },
            body: payload,
        });
    },
    async browseRuns(query) {
        const response = await callEndpoint({
            ...Endpoints.browseScrapingRuns,
            path: withQuery(Endpoints.browseScrapingRuns.path, query),
        });
        return unwrapPagedResponse(response);
    },
    async createRun(payload) {
        const response = await callEndpoint(Endpoints.createScrapingRun, {
            body: payload,
        });
        return unwrapApiResponse(response);
    },
    async startRun(runId) {
        await callEndpoint(Endpoints.startScrapingRun, { params: { runId } });
    },
    async completeRun(runId, payload) {
        await callEndpoint(Endpoints.completeScrapingRun, {
            params: { runId },
            body: payload,
        });
    },
    async failRun(runId, payload) {
        await callEndpoint(Endpoints.failScrapingRun, {
            params: { runId },
            body: payload,
        });
    },
    async retryRun(runId, reason) {
        await callEndpoint(Endpoints.retryScrapingRun, {
            params: { runId },
            body: { reason },
        });
    },
    async browseEvidences(query) {
        const response = await callEndpoint({
            ...Endpoints.browseScrapedEvidences,
            path: withQuery(Endpoints.browseScrapedEvidences.path, query),
        });
        return unwrapPagedResponse(response);
    },
    async createEvidence(payload) {
        const response = await callEndpoint(Endpoints.createScrapedEvidence, { body: payload });
        return unwrapApiResponse(response);
    },
    async deleteEvidence(evidenceId) {
        await callEndpoint(Endpoints.deleteScrapedEvidence, { params: { evidenceId } });
    },
    async browseRateCandidates(query) {
        const response = await callEndpoint({
            ...Endpoints.browseScrapedRateCandidates,
            path: withQuery(Endpoints.browseScrapedRateCandidates.path, query),
        });
        return unwrapPagedResponse(response);
    },
    async createRateCandidate(payload) {
        const response = await callEndpoint(Endpoints.createScrapedRateCandidate, { body: payload });
        return unwrapApiResponse(response);
    },
    async normalizeRateCandidate(candidateId, payload) {
        await callEndpoint(Endpoints.normalizeScrapedRateCandidate, { params: { candidateId }, body: payload });
    },
    async approveRateCandidate(candidateId, notes) {
        await callEndpoint(Endpoints.approveScrapedRateCandidate, {
            params: { candidateId },
            body: { notes },
        });
    },
    async rejectRateCandidate(candidateId, reason) {
        await callEndpoint(Endpoints.rejectScrapedRateCandidate, {
            params: { candidateId },
            body: { reason },
        });
    },
    async sendRateCandidateToPricing(candidateId, payload) {
        await callEndpoint(Endpoints.sendScrapedRateCandidateToPricing, { params: { candidateId }, body: payload });
    },
    async browseExtractionRules(query) {
        const response = await callEndpoint({
            ...Endpoints.browseExtractionRules,
            path: withQuery(Endpoints.browseExtractionRules.path, query),
        });
        return unwrapPagedResponse(response);
    },
    async createExtractionRule(payload) {
        const response = await callEndpoint(Endpoints.createExtractionRule, { body: payload });
        return unwrapApiResponse(response);
    },
    async updateExtractionRule(ruleId, payload) {
        await callEndpoint(Endpoints.updateExtractionRule, {
            params: { ruleId },
            body: payload,
        });
    },
    async approveExtractionRule(ruleId, notes) {
        await callEndpoint(Endpoints.approveExtractionRule, {
            params: { ruleId },
            body: { notes },
        });
    },
    async rejectExtractionRule(ruleId, reason) {
        await callEndpoint(Endpoints.rejectExtractionRule, {
            params: { ruleId },
            body: { reason },
        });
    },
    async setExtractionRuleActive(ruleId, isActive) {
        await callEndpoint(Endpoints.setExtractionRuleActive, {
            params: { ruleId },
            body: { isActive },
        });
    },
    async deleteExtractionRule(ruleId) {
        await callEndpoint(Endpoints.deleteExtractionRule, { params: { ruleId } });
    },
    async executeManual(payload) {
        const response = await callEndpoint(Endpoints.executeManualWebScraping, { body: payload });
        return unwrapApiResponse(response);
    },
    async bootstrapAuthentication(payload) {
        const response = await callEndpoint(Endpoints.bootstrapWebScrapingAuth, { body: payload });
        return unwrapApiResponse(response);
    },
};
