/**
 * Created by fengxiaochuang on 2017/7/18.
 */
const ffmpeg = require('fluent-ffmpeg'),
    _ = require('lodash'),
    fs = require('fs'),
    convert = require('./pcm2wav'),
    Duplex = require('stream').Duplex;

/**
 * ffmpeg处理类
 */
class FFmpeg {

    /**
     * 判断是否是audio数据
     * @param path
     * @returns {Promise}
     */
    static async isAudio(path) {
        return new Promise((resole, reject) => {
            if (_.endsWith(_.toLower(path), ".mp3")) {
                let f = fs.createReadStream(path);
                let file_header = "";
                f.on("data", (chunk) => {
                    file_header += String(chunk[0]) + String(chunk[1]);
                    f.close();
                }).on("close", function () {
                    resole(file_header === "7368");
                })
            } else {
                resole(true);
            }
        })
    }

    /**
     * 读取文件信息
     * @param path
     * @return {Promise}
     */
    static async fileInfo(path) {
        // let is_audio = await FFmpeg.isAudio(path);
        return new Promise((resole, reject) => {
            // if (!is_audio) {
            //     resole(0);
            // } else {
            ffmpeg.ffprobe(path, function (err, metadata) {
                if (err) {
                    // 记录错误信息
                    // global.track_log.error(err);
                    resole(0);
                }
                if (metadata) {
                    // 提取有效信息
                    let format = metadata['format'];
                    // 返回时长
                    resole(format.duration);
                } else {
                    resole(0);
                }
            });
            // }
        });
    }

    /**
     * 所有的文件信息
     * @param path
     * @returns {Promise}
     */
    static async audioInfo(path) {
        // let is_audio = await FFmpeg.isAudio(path);
        return new Promise((resole, reject) => {
            // if (!is_audio) {
            //     resole(null);
            // } else {
            ffmpeg.ffprobe(path, function (err, metadata) {
                if (err) {
                    // 记录错误信息
                    // global.track_log.error(err);
                    resole(null);
                }
                if (metadata) {
                    // 提取有效信息
                    let info = metadata.streams[0];
                    if (info !== undefined) {
                        // 返回时长
                        resole(info);
                    } else {
                        resole(null);
                    }
                } else {
                    resole(null);
                }
            });
            // }
        });
    }

    /**
     * 文件转换为16k
     * @param source_path
     * @return {Promise}
     */
    static async fileConvert16KWav(source_path) {
        return new Promise(async (resole, reject) => {
            let save_path = source_path + ".wav";
            let file_exist = await FFmpeg.audioFileSame(source_path, save_path);
            if (file_exist) {
                resole(save_path);
            } else {
                ffmpeg(source_path).audioChannels(1).audioBitrate(16).audioFrequency(16000).outputFormat('wav')
                    .save(save_path).on('error', (err) => {
                    reject(err);
                }).on('end', () => {
                    resole(save_path);
                });
            }
        });
    }

    /**
     * 文件转换为8k
     * @param source_path
     * @return {Promise}
     */
    static async fileConvert8KWav(source_path) {
        return new Promise(async (resole, reject) => {
            let save_path = source_path + ".wav";
            let file_exist = await FFmpeg.audioFileSame(source_path, save_path);
            if (file_exist) {
                resole(save_path);
            } else {
                ffmpeg(source_path).audioChannels(1).audioBitrate(16).audioFrequency(8000).outputFormat('wav')
                    .save(source_path + '.wav').on('error', (err) => {
                    reject(err);
                }).on('end', () => {
                    resole(save_path);
                });
            }
        });
    }

    /**
     * 判断两个文件是否相似
     * @param source_path
     * @param save_path
     * @returns {Promise<void>}
     */
    static async audioFileSame(source_path, save_path) {
        return new Promise(async (resolve, reject) => {
            try {
                if (fs.existsSync(source_path) && fs.existsSync(save_path)) {
                    // 判断原来的文件是不是已经存在了
                    let source_path_info = await FFmpeg.audioInfo(source_path);
                    let save_path_info = await  FFmpeg.audioInfo(save_path);
                    if (source_path_info !== null && save_path_info !== null) {
                        if (Math.abs(source_path_info.duration - save_path_info.duration) < 1.5
                            && source_path_info.duration !== undefined
                        ) {
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    }
                } else {
                    resolve(false);
                }
            } catch (err) {
                resolve(false);
            }
        });
    }

    /**
     * 文件转换为mp3
     * @param source_path
     * @param save_file
     * @return {Promise}
     */
    static async fileConvertMp3(source_path, save_file) {
        var save_file_path = save_file;
        if (save_file_path === undefined) {
            save_file_path = source_path + '.mp3';
        }
        return new Promise((resole, reject) => {
            ffmpeg(source_path)
                .withAudioBitrate('24k')
                .audioChannels(1)
                .outputOptions([
                    '-write_xing 0',
                ]).save(save_file_path).on('error', (err) => {
                reject(err);
            }).on('end', () => {
                resole(save_file_path);
            });
        });
    }

    /**
     * 剪切固定时长的声音进行识别
     * @param source_path
     * @param seconds
     * @return {Promise}
     */
    static async cutAudio(source_path, seconds) {
        return new Promise((resole, reject) => {
            ffmpeg(source_path).setStartTime(0).duration(seconds).audioChannels(1).audioBitrate(16).audioFrequency(16000).outputFormat('wav').save(source_path + '.cut.wav')
                .on('error', (err) => {
                    reject(err);
                }).on('end', () => {
                resole(source_path + '.cut.wav');
            });
        });
    }

    /**
     * pcm 转wav文件
     * @param source_path
     * @return {Promise.<void>}
     */
    static async pcm2Wav(source_path) {
        return new Promise((resole, reject) => {
            // ffmpeg -f s16be -ar 8000 -ac 2 -acodec pcm_s16be -i
            // input.raw output.wav
            ffmpeg(source_path).inputOptions([
                '-f s16le',
                '-ar 16000',
                '-ac 1',
            ]).save(source_path + '.wav').on('error', (err) => {
                reject(err);
            }).on('end', () => {
                resole(source_path + '.wav');
            });
        });
    }

    /**
     * 合并语音文件
     * @param source_path_list
     * @param save_filename
     * @param save_path
     * @return {Promise}
     */
    static async mergeMP3Audio(source_path_list, save_filename, save_path) {
        return new Promise((resolve, reject) => {
            let command = ffmpeg();
            for (let i in source_path_list) {
                let tmp_path = source_path_list[i];
                if (fs.existsSync(tmp_path)) {
                    let file_stat = fs.statSync(tmp_path);
                    if (file_stat.size > 10) {
                        command = command.input(source_path_list[i]);
                    }
                }
            }

            command
                .mergeToFile(save_filename + '.mp3', save_path)
                .on('error', (err) => {
                    reject(err);
                })
                .on('end', async () => {
                    try {
                        await FFmpeg.convertMP3toWav(save_filename + '.mp3');
                        // 清理子文件
                        for (let i in source_path_list) {
                            let tmp_path = source_path_list[i];
                            fs.unlinkSync(tmp_path);
                        }
                    } catch (err) {
                        reject(err);
                    }
                    resolve(save_filename + '.mp3');
                })
        })
    }

    /**
     * mp3转wav
     * @return {Promise}
     * @param source_path
     */
    static async convertMP3toWav(source_path) {
        return new Promise((resolve, reject) => {
            let wav_path = source_path.substring(0, source_path.length - 3) + "wav"
            ffmpeg(source_path)
                .audioChannels(1)
                .audioBitrate(16)
                .audioFrequency(8000)
                .outputFormat('wav')
                .save(wav_path)
                .on("error", (err) => {
                    reject(err);
                }).on("end", () => {
                resolve(wav_path);
            })
        });
    }

    /**
     * TTS合并成MP3和wav
     * @param source_path_list
     * @param save_filename
     * @return {Promise}
     */
    static async mergePCM(source_path_list, save_filename) {
        return new Promise((resole, reject) => {
            try {
                // 初始化stream
                const bufferToStream = (buffer) => {
                    let stream = new Duplex();
                    stream.push(buffer);
                    stream.push(null);
                    return stream;
                };
                // 初始化bufferlist
                let bufferList = [];
                // 循环读取文件
                _.forEach(source_path_list, (item) => {
                    bufferList.push(fs.readFileSync(item));
                });
                // 拼接数据buffer
                let buffer = Buffer.concat(bufferList);
                // pcm buffer转 wav buffer
                let bufferStream = convert(buffer);
                // 输入进行转换
                ffmpeg().input(bufferToStream(bufferStream))
                    .save(save_filename + '.mp3')
                    .output(save_filename + '.wav')
                    .audioChannels(1).audioBitrate(16).audioFrequency(16000).outputFormat('wav')
                    .on('error', (err) => {
                        reject(err);
                    }).on('end', () => {
                    resole(save_filename + '.wav');
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    static async mixBGM(source_path, bgm_path) {
        return new Promise(async (resolve, reject) => {
            let save_path = source_path.substring(0, source_path.length - 3) + "withbgm.wav";
            ffmpeg(bgm_path)
                .input(source_path)
                .inputOptions([
                    '-filter_complex amix=inputs=2:duration=first:dropout_transition=0',
                ])
                // .audioBitrate('24k')
                // .audioCodec('libmp3lame')
                // .audioQuality(4)
                .save(save_path)
                .on("error", (err) => {
                    reject(err);
                }).on("end", () => {
                resolve(save_path);
            })
        })
    }

    /**
     * 合并生成背景音乐的文件音乐
     * @param source_path
     * @param bgm_path
     * @param bgm_volume
     * @returns {Promise}
     */
    static async mergeBGM(source_path, bgm_path, bgm_volume) {
        return new Promise(async (resole, reject) => {
            try {
                let source_duration = await FFmpeg.fileInfo(source_path);
                if (source_duration === 0) {
                    reject(new Error("无效的合成文件路径:" + source_path));
                }

                let bgm_duration = await FFmpeg.fileInfo(bgm_path);
                if (source_duration === 0) {
                    reject(new Error("无效的BGM文件路径:" + bgm_path));
                }
                let repeat;
                let start;
                let end;
                if (source_duration > bgm_duration) {
                    repeat = Math.ceil(source_duration, bgm_duration);
                } else {
                    repeat = 1;
                }
                end = source_duration - 8;
                let bgm_save_path = source_path.substring(0, source_path.length - 3) + "bgm.wav";
                ffmpeg(bgm_path)
                    .inputOptions([
                        `-stream_loop ${repeat}`,
                    ])
                    .audioFilters(
                        [
                            `afade=t=in:ss=0:d=10`,
                            `afade=t=out:st=${end}:d=10`,
                            `volume=volume=${bgm_volume}`
                        ]
                    )
                    .duration(source_duration + 3)
                    .outputOptions(["-write_xing 0"])
                    .save(bgm_save_path)
                    .on("error", (err) => {
                        reject(err);
                    }).on("end", async () => {
                    // resole(save_path);
                    // 拼接文件
                    try {
                        let wav_save_path = await FFmpeg.mixBGM(source_path, bgm_save_path);
                        let mp3_save_path = source_path.substring(0, source_path.length - 3) + "withbgm.mp3";
                        await FFmpeg.fileConvertMp3(wav_save_path, mp3_save_path);
                        resole(mp3_save_path);
                        // 清理中间文件 bgm_save_path
                        // source_path 暂不清理
                        fs.unlink(bgm_save_path);
                    } catch (err) {
                        reject(err);
                    }
                })
            } catch (err) {
                reject(err);
            }
        });
    }

}

module.exports = FFmpeg;
