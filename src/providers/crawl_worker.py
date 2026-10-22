"""Isolated, bounded browser worker. No stealth, proxy, CAPTCHA or network bypass."""
import asyncio
import json
import sys

async def render(data):
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
    async def offline(page, context, **kwargs):
        await context.set_offline(True)
        await context.route('**/*', lambda route: route.abort())
        return page
    config=BrowserConfig(headless=True, browser_type='chromium', verbose=False,
                         enable_stealth=False, user_agent='OneFolk provider benchmark (offline rendering)')
    async with AsyncWebCrawler(config=config) as crawler:
        crawler.crawler_strategy.set_hook('on_page_context_created',offline)
        result=await crawler.arun(url='raw:'+data['html'], config=CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS, process_in_browser=True, base_url=data['url'],
            wait_until='domcontentloaded', page_timeout=15000, delay_before_return_html=0.2,
            word_count_threshold=1, verbose=False))
        return {'success':result.success,'html':result.html,'source_url':data['url']}

if __name__=='__main__':
    data=json.loads(sys.stdin.read(2000000))
    if len(data['html'])>250000: raise ValueError('Snapshot exceeds transport limit')
    print('ONEFOLK_RESULT='+json.dumps(asyncio.run(render(data))))
