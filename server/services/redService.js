const axios = require('axios')
const querystring = require('querystring')
const rohr = require('../util/rohr')
const crypto = require('../util/crypto')


const origin = 'https://activity.waimai.meituan.com'

var initAxios = function (url) {
    this.params = {
        //urlKey: '477F96D5BB4C42D38E9CCDD4DA3B2AE0',
        urlKey: 'F10DC93CF0374537AE6786F2A660AB10',
        state: 123,
        // code: '003MxfCd1vo7Fr0pPJzd1cMmCd1MxfCW',
        code: '0039lvvt0Tavke1D5rtt0cbGvt09lvvP',
        uiId: 0,
        channelUrlKey: url.match(/\/(?:sharechannelredirect|sharechannel)\/(.*?)\?/).pop(),
    }
}
initAxios.prototype = {
    request: function () {
        return axios.create({
            baseURL: origin,
            headers: {
                origin,
                referer: origin,
                'user-agent': 'Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T MicroMessenger) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.23 Mobile Safari/537.36'
            },
            transformRequest: [data => querystring.stringify(data)]
        })
    },

    /**
     * 基础包装post请求
     */
    post: async function (url, _params) {
        this.params._token = rohr.reload(url + '?' + querystring.stringify(_params))
        const { data } = await this.request().post(url, this.params)
        data.data = crypto(data.data)
        if (typeof data.data === 'string') {
            data.data = JSON.parse(data.data)
        }
        return data
    },
    /**
     * 根据初始参数,获取红包信息
     * @param _token 页面token
     * @param channelUrlKey
     * @param code
     * @param state
     * @param uiId
     * @param urlKey
     * 
     * @returns { code，dparam, share_title .... }
     */
    getReturnData: async function () {
        const data = await this.post('/async/coupon/sharechannelredirect', this.params)
        return data
    },
    /**
     * 获取最大
     */
    lucky: async function () {
        const data = await this.getReturnData()
        const number = data.data.share_title.match(/第(\d+)个/).pop()
        return number
    },

    /**
     * 领取红包的逻辑
     */
    lottery: async function (opt) {
        var _this = this
        const data = await this.getReturnData()
        const res = await (async function grabShareCoupon() {
            if (!opt.cookie) {
                console.log('没这么多微信号 或 红包链接不正确')
                throw new Error('红包链接不正确\n或\n请求美团服务器失败')
            }

            _this.params.userPhone = opt.mobile
            _this.params.dparam = data.data.dparam
            _this.params.originUrl = opt.url
            _this.params.baseChannelUrlKey = ''
            _this.params.uuid = ''
            _this.params.platform = 11
            _this.params.partner = 162
            _this.params.riskLevel = 71

            const rest = await _this.post('/coupon/grabShareCoupon', _this.params,
                //   {
                //     userPhone: opt.mobile,
                //     channelUrlKey: data.channelUrlKey,
                //     urlKey: data.urlKey,
                //     dparam: data.dparam,
                //     originUrl: opt.url,
                //     baseChannelUrlKey: '',
                //     uuid: '',
                //     platform: 11,
                //     partner: 162,
                //     riskLevel: 71 
                //  },
                {
                    headers: {
                        cookie: opt.cookie
                    }
                })

            // 4201 需要验证码
            // 1006 该号码归属地暂不支持
            // 1 成功
            // 7003 已领过
            // 4000 抢光了
            // 7002 微信 cookie 不正确或失效
            // 7006 今日领取次数达达到上限。领取次数居然是跟微信号走的，做公开服务暂时无解
            console.log(rest)
            // if ([1, 4000, 7003].includes(res.code)) {
            //     return res
            // }
            // if (res.code === 7002) {
            //     throw new Error(`账号（${index}）无效，需要更新 cookie`)
            // }
            // if (res.code === 7006) {
            //     const [first, other] = cookies
            //     cookies = [other, first]
            // }            
            // return grabShareCoupon()
            return rest
        })()

        const length = res.data.wxCoupons.length
        // const number = await this.lucky()
        const number = data.data.share_title.match(/第(\d+)个/).pop()


        if ((number - length) <= 0) {
            // console.log('手气最佳红包已被领取')
            const length = res.data.wxCoupons.length
            return res.data.wxCoupons.find(w => w.bestLuck)
        }
        console.log('还有 ' + number + ' 个是最佳红包')

        // return _this.lottery(number === 1 ? opt.mobile : null)
    }
}

module.exports = async params => {
    try {
        const init = new initAxios(params.url)
        const res = await init.lottery(params)
        // console.log(res)
        return { message: `手气最佳红包已被领取\n\n手气最佳：${res.nick_name}\n红包金额：${res.coupon_price / 100} 元\n领取时间：${res.dateStr}` }
    } catch (e) {
        console.error(e)
        return { message: e.message }
    }
}