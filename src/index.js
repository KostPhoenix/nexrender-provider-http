const fs = require('fs')
const fetch = require('node-fetch').default;
const FormData = require('form-data');

class ChunkUploader {
    constructor(src, job, chunkSize, destinationUri) {
        this.file = fs.readFileSync(src);
        const stats = fs.statSync(src);
        this.fileSizeInBytes = stats.size;
        this.job = job;
        this.chunkSize = chunkSize;
        this.destinationUri = destinationUri;
        this.startBytes = 0;
    }

    startUpload() {
        return new Promise((resolve, reject) => {
            const chunk = this.nextChunk();
            this.upload(chunk)
                .then(() => {
                    this.startBytes += this.chunkSize
                    if (this.startBytes >= this.fileSizeInBytes) {
                        return resolve('end');
                    }

                    return resolve(this.startUpload());
                })
                .catch(reject);
        });
    }

    chunkEnd() {
        return Math.min(this.startBytes + this.chunkSize, this.fileSizeInBytes)
    }

    nextChunk() {
        const chunkEndBytes = this.chunkEnd();
        console.log(this.startBytes + ' ' + chunkEndBytes);
        return this.file.slice(this.startBytes, chunkEndBytes);
    }

    upload(chunk) {
        const formData = new FormData();
        formData.append('file', chunk);
        formData.append('uid', this.job.uid);
        return fetch(this.destinationUri, {
            method: 'POST',
            body: formData
        })
    }
}

const upload = (job, settings, src, params) => {
    return new Promise((resolve, reject) => {
        if (!params.destinationUri) throw new Error('Destination uri not provided.');
        const chunkSize = params.chunkSize || 2 * 1024 * 1024;
        const isChunkUpload = params.chunkUpload || false;

        if (isChunkUpload) {
            const chunkUploader = new ChunkUploader(src, job, chunkSize, params.destinationUri);
            return chunkUploader.startUpload().then(resolve);
        }

        const file = fs.createReadStream(src);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('uid', job.uid);
        return fetch(params.destinationUri, {
            method: 'POST',
            body: formData
        })
            .then(resolve)
            .catch(reject);
    });
}

module.exports = {
    upload
}