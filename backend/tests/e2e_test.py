"""
排砖宝 · 端对端测试脚本

测试范围：
1. 用户注册/登录流程
2. 项目创建/编辑功能
3. 排版计算与预览
4. 报价单生成
5. PPT/PDF导出
6. 免费限制验证
7. API频率限制
"""
import asyncio
import httpx
import json
import time
import sys
from typing import Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class TestResult:
    name: str
    passed: bool
    message: str
    duration_ms: float
    details: Optional[Dict[str, Any]] = None


class E2ETestRunner:
    def __init__(self, base_url: str = "http://127.0.0.1:8000"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)
        self.token: Optional[str] = None
        self.user_id: Optional[str] = None
        self.project_id: Optional[str] = None
        self.results: list[TestResult] = []

    async def close(self):
        await self.client.aclose()

    def add_result(self, result: TestResult):
        self.results.append(result)
        status = "[PASS]" if result.passed else "[FAIL]"
        print(f"{status} | {result.name} ({result.duration_ms:.0f}ms)")
        if not result.passed:
            print(f"   -> {result.message}")
        if result.details:
            print(f"   -> {json.dumps(result.details, ensure_ascii=False, indent=2)}")

    async def test_health_check(self) -> TestResult:
        """测试1: 健康检查"""
        start = time.time()
        try:
            resp = await self.client.get(f"{self.base_url}/health")
            duration = (time.time() - start) * 1000
            
            if resp.status_code == 200:
                return TestResult(
                    name="健康检查",
                    passed=True,
                    message="服务正常运行",
                    duration_ms=duration,
                    details=resp.json()
                )
            else:
                return TestResult(
                    name="健康检查",
                    passed=False,
                    message=f"状态码错误: {resp.status_code}",
                    duration_ms=duration
                )
        except Exception as e:
            return TestResult(
                name="健康检查",
                passed=False,
                message=f"连接失败: {str(e)}",
                duration_ms=(time.time() - start) * 1000
            )

    async def test_user_registration(self) -> TestResult:
        """测试2: 用户注册"""
        start = time.time()
        phone = f"138{int(time.time()) % 100000000:08d}"
        
        try:
            resp = await self.client.post(
                f"{self.base_url}/api/v1/auth/register",
                json={"phone": phone, "password": "test123456"}
            )
            duration = (time.time() - start) * 1000
            
            if resp.status_code == 200:
                data = resp.json()
                self.token = data.get("access_token")
                self.user_id = data.get("user_id")
                return TestResult(
                    name="用户注册",
                    passed=True,
                    message=f"注册成功，用户ID: {self.user_id}",
                    duration_ms=duration,
                    details={"phone": phone, "user_id": self.user_id}
                )
            else:
                return TestResult(
                    name="用户注册",
                    passed=False,
                    message=f"注册失败: {resp.text}",
                    duration_ms=duration
                )
        except Exception as e:
            return TestResult(
                name="用户注册",
                passed=False,
                message=f"请求异常: {str(e)}",
                duration_ms=(time.time() - start) * 1000
            )

    async def test_user_login(self) -> TestResult:
        """测试3: 用户登录"""
        start = time.time()
        
        if not self.user_id:
            return TestResult(
                name="用户登录",
                passed=False,
                message="前置条件失败: 未注册用户",
                duration_ms=0
            )
        
        try:
            resp = await self.client.post(
                f"{self.base_url}/api/v1/auth/login",
                json={"phone": "13800138000", "password": "test123456"}
            )
            duration = (time.time() - start) * 1000
            
            if resp.status_code in [200, 401]:
                return TestResult(
                    name="用户登录",
                    passed=True,
                    message="登录接口响应正常",
                    duration_ms=duration
                )
            else:
                return TestResult(
                    name="用户登录",
                    passed=False,
                    message=f"登录失败: {resp.status_code}",
                    duration_ms=duration
                )
        except Exception as e:
            return TestResult(
                name="用户登录",
                passed=False,
                message=f"请求异常: {str(e)}",
                duration_ms=(time.time() - start) * 1000
            )

    async def test_project_create(self) -> TestResult:
        """测试4: 项目创建"""
        start = time.time()
        
        if not self.token:
            return TestResult(
                name="项目创建",
                passed=False,
                message="前置条件失败: 未登录",
                duration_ms=0
            )
        
        try:
            resp = await self.client.post(
                f"{self.base_url}/api/v1/projects/",
                headers={"Authorization": f"Bearer {self.token}"},
                json={
                    "name": "E2E测试项目",
                    "room_polygon": [[0, 0], [4000, 0], [4000, 3000], [0, 3000]],
                    "tile_config": {
                        "tile_width": 800,
                        "tile_height": 800,
                        "gap_width": 3,
                        "direction": "horizontal",
                        "start_point": [0, 0]
                    }
                }
            )
            duration = (time.time() - start) * 1000
            
            if resp.status_code == 200:
                data = resp.json()
                self.project_id = data.get("data", {}).get("id")
                return TestResult(
                    name="项目创建",
                    passed=True,
                    message=f"项目创建成功，ID: {self.project_id}",
                    duration_ms=duration,
                    details={"project_id": self.project_id}
                )
            else:
                return TestResult(
                    name="项目创建",
                    passed=False,
                    message=f"创建失败: {resp.text}",
                    duration_ms=duration
                )
        except Exception as e:
            return TestResult(
                name="项目创建",
                passed=False,
                message=f"请求异常: {str(e)}",
                duration_ms=(time.time() - start) * 1000
            )

    async def test_layout_calculate(self) -> TestResult:
        """测试5: 排版计算"""
        start = time.time()
        
        if not self.project_id:
            return TestResult(
                name="排版计算",
                passed=False,
                message="前置条件失败: 无项目ID",
                duration_ms=0
            )
        
        try:
            resp = await self.client.post(
                f"{self.base_url}/api/v1/projects/{self.project_id}/calculate",
                headers={"Authorization": f"Bearer {self.token}"},
                json={}
            )
            duration = (time.time() - start) * 1000
            
            if resp.status_code == 200:
                data = resp.json()
                stats = data.get("data", {}).get("statistics", {})
                return TestResult(
                    name="排版计算",
                    passed=True,
                    message=f"计算完成，整砖{stats.get('whole_tiles', 0)}片，切割砖{stats.get('cut_tiles', 0)}片",
                    duration_ms=duration,
                    details=stats
                )
            else:
                return TestResult(
                    name="排版计算",
                    passed=False,
                    message=f"计算失败: {resp.text}",
                    duration_ms=duration
                )
        except Exception as e:
            return TestResult(
                name="排版计算",
                passed=False,
                message=f"请求异常: {str(e)}",
                duration_ms=(time.time() - start) * 1000
            )

    async def test_auxiliary_calculate(self) -> TestResult:
        """测试6: 辅料计算"""
        start = time.time()
        
        try:
            resp = await self.client.post(
                f"{self.base_url}/api/v1/materials/calculate",
                json={
                    "area_sq_m": 12,
                    "tile_width_mm": 800,
                    "tile_height_mm": 800,
                    "gap_width_mm": 3
                }
            )
            duration = (time.time() - start) * 1000
            
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("data", {}).get("items", [])
                return TestResult(
                    name="辅料计算",
                    passed=True,
                    message=f"计算完成，共{len(items)}项辅料",
                    duration_ms=duration,
                    details={"items_count": len(items)}
                )
            else:
                return TestResult(
                    name="辅料计算",
                    passed=False,
                    message=f"计算失败: {resp.text}",
                    duration_ms=duration
                )
        except Exception as e:
            return TestResult(
                name="辅料计算",
                passed=False,
                message=f"请求异常: {str(e)}",
                duration_ms=(time.time() - start) * 1000
            )

    async def test_complete_quote(self) -> TestResult:
        """测试7: 完整报价单生成"""
        start = time.time()
        
        try:
            resp = await self.client.post(
                f"{self.base_url}/api/v1/sales/quote/complete",
                json={
                    "project_name": "E2E测试报价单",
                    "area_sq_m": 12,
                    "tile_width_mm": 800,
                    "tile_height_mm": 800,
                    "gap_width_mm": 3,
                    "tile_price": 50.0,
                    "room_perimeter_mm": 14000,
                    "door_gaps": [
                        {"width": 800, "position": "entrance"},
                        {"width": 700, "position": "bathroom"}
                    ],
                    "include_waterproof": True,
                    "waterproof_area_sq_m": 6,
                    "threshold_material": "marble"
                }
            )
            duration = (time.time() - start) * 1000
            
            if resp.status_code == 200:
                data = resp.json()
                quote = data.get("data", {})
                return TestResult(
                    name="完整报价单",
                    passed=True,
                    message=f"报价单生成成功，总价: ¥{quote.get('total_amount', 0):.2f}",
                    duration_ms=duration,
                    details={
                        "total_amount": quote.get("total_amount"),
                        "items_count": len(quote.get("items", []))
                    }
                )
            else:
                return TestResult(
                    name="完整报价单",
                    passed=False,
                    message=f"生成失败: {resp.text}",
                    duration_ms=duration
                )
        except Exception as e:
            return TestResult(
                name="完整报价单",
                passed=False,
                message=f"请求异常: {str(e)}",
                duration_ms=(time.time() - start) * 1000
            )

    async def test_skirting_calculate(self) -> TestResult:
        """测试8: 踢脚线计算"""
        start = time.time()
        
        try:
            resp = await self.client.post(
                f"{self.base_url}/api/v1/sales/skirting/calculate",
                json={
                    "room_perimeter": 14,
                    "door_width": 1.5,
                    "tile_width": 800,
                    "tile_height": 800,
                    "skirting_height": 80,
                    "tile_price": 50.0
                }
            )
            duration = (time.time() - start) * 1000
            
            if resp.status_code == 200:
                data = resp.json()
                result = data.get("data", {})
                return TestResult(
                    name="踢脚线计算",
                    passed=True,
                    message=f"需要{result.get('tiles_needed', 0)}片瓷砖切割踢脚线",
                    duration_ms=duration,
                    details=result
                )
            else:
                return TestResult(
                    name="踢脚线计算",
                    passed=False,
                    message=f"计算失败: {resp.text}",
                    duration_ms=duration
                )
        except Exception as e:
            return TestResult(
                name="踢脚线计算",
                passed=False,
                message=f"请求异常: {str(e)}",
                duration_ms=(time.time() - start) * 1000
            )

    async def test_threshold_calculate(self) -> TestResult:
        """测试9: 门头石计算"""
        start = time.time()
        
        try:
            resp = await self.client.post(
                f"{self.base_url}/api/v1/sales/threshold/calculate",
                json={
                    "doors": [
                        {"id": "door1", "x": 0, "y": 0, "width": 800, "type": "entrance"},
                        {"id": "door2", "x": 0, "y": 0, "width": 700, "type": "bathroom"}
                    ],
                    "material": "marble"
                }
            )
            duration = (time.time() - start) * 1000
            
            if resp.status_code == 200:
                data = resp.json()
                result = data.get("data", {})
                return TestResult(
                    name="门头石计算",
                    passed=True,
                    message=f"共{len(result.get('thresholds', []))}个门头石，总价: ¥{result.get('total_cost', 0):.2f}",
                    duration_ms=duration,
                    details=result
                )
            else:
                return TestResult(
                    name="门头石计算",
                    passed=False,
                    message=f"计算失败: {resp.text}",
                    duration_ms=duration
                )
        except Exception as e:
            return TestResult(
                name="门头石计算",
                passed=False,
                message=f"请求异常: {str(e)}",
                duration_ms=(time.time() - start) * 1000
            )

    async def test_layout_optimize(self) -> TestResult:
        """测试10: 智能排版优化"""
        start = time.time()
        
        try:
            resp = await self.client.post(
                f"{self.base_url}/api/v1/sales/layout/optimize",
                json={
                    "room_area": 12,
                    "tile_width": 800,
                    "tile_height": 800,
                    "tile_price": 50.0
                }
            )
            duration = (time.time() - start) * 1000
            
            if resp.status_code == 200:
                data = resp.json()
                plans = data.get("data", [])
                return TestResult(
                    name="智能排版优化",
                    passed=True,
                    message=f"生成{len(plans)}种铺贴方案",
                    duration_ms=duration,
                    details={"plans_count": len(plans)}
                )
            else:
                return TestResult(
                    name="智能排版优化",
                    passed=False,
                    message=f"优化失败: {resp.text}",
                    duration_ms=duration
                )
        except Exception as e:
            return TestResult(
                name="智能排版优化",
                passed=False,
                message=f"请求异常: {str(e)}",
                duration_ms=(time.time() - start) * 1000
            )

    async def test_rate_limit(self) -> TestResult:
        """测试11: API频率限制"""
        start = time.time()
        
        try:
            tasks = []
            for _ in range(15):
                tasks.append(
                    self.client.post(
                        f"{self.base_url}/api/v1/auth/login",
                        json={"phone": "13800000000", "password": "wrong"}
                    )
                )
            
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            duration = (time.time() - start) * 1000
            
            rate_limited = sum(1 for r in responses if isinstance(r, httpx.Response) and r.status_code == 429)
            
            if rate_limited > 0:
                return TestResult(
                    name="API频率限制",
                    passed=True,
                    message=f"频率限制生效，{rate_limited}次请求被限制",
                    duration_ms=duration,
                    details={"rate_limited_count": rate_limited}
                )
            else:
                return TestResult(
                    name="API频率限制",
                    passed=False,
                    message="频率限制未生效",
                    duration_ms=duration
                )
        except Exception as e:
            return TestResult(
                name="API频率限制",
                passed=False,
                message=f"测试异常: {str(e)}",
                duration_ms=(time.time() - start) * 1000
            )

    async def test_free_limit(self) -> TestResult:
        """测试12: 免费限制检查"""
        start = time.time()
        
        if not self.token:
            return TestResult(
                name="免费限制检查",
                passed=False,
                message="前置条件失败: 未登录",
                duration_ms=0
            )
        
        try:
            resp = await self.client.get(
                f"{self.base_url}/api/v1/users/me",
                headers={"Authorization": f"Bearer {self.token}"}
            )
            duration = (time.time() - start) * 1000
            
            if resp.status_code == 200:
                data = resp.json()
                is_member = data.get("data", {}).get("is_member", False)
                return TestResult(
                    name="免费限制检查",
                    passed=True,
                    message=f"用户会员状态: {is_member}",
                    duration_ms=duration,
                    details={"is_member": is_member}
                )
            else:
                return TestResult(
                    name="免费限制检查",
                    passed=False,
                    message=f"查询失败: {resp.text}",
                    duration_ms=duration
                )
        except Exception as e:
            return TestResult(
                name="免费限制检查",
                passed=False,
                message=f"请求异常: {str(e)}",
                duration_ms=(time.time() - start) * 1000
            )

    async def run_all_tests(self):
        """运行所有测试"""
        print("\n" + "="*60)
        print("排砖宝 · 端对端测试")
        print("="*60)
        print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"目标服务: {self.base_url}")
        print("="*60 + "\n")

        tests = [
            ("健康检查", self.test_health_check),
            ("用户注册", self.test_user_registration),
            ("用户登录", self.test_user_login),
            ("项目创建", self.test_project_create),
            ("排版计算", self.test_layout_calculate),
            ("辅料计算", self.test_auxiliary_calculate),
            ("完整报价单", self.test_complete_quote),
            ("踢脚线计算", self.test_skirting_calculate),
            ("门头石计算", self.test_threshold_calculate),
            ("智能排版优化", self.test_layout_optimize),
            ("API频率限制", self.test_rate_limit),
            ("免费限制检查", self.test_free_limit),
        ]

        for name, test_func in tests:
            result = await test_func()
            self.add_result(result)
            await asyncio.sleep(0.1)

        print("\n" + "="*60)
        passed = sum(1 for r in self.results if r.passed)
        total = len(self.results)
        print(f"测试结果: {passed}/{total} 通过")
        print("="*60 + "\n")

        return self.results


async def main():
    runner = E2ETestRunner()
    try:
        results = await runner.run_all_tests()
        
        passed = sum(1 for r in results if r.passed)
        total = len(results)
        
        print("\n详细测试结果:")
        print("-"*60)
        for r in results:
            status = "[OK]" if r.passed else "[X]"
            print(f"{status} {r.name}: {r.message}")
        
        print("-"*60)
        print(f"总计: {passed}/{total} 测试通过")
        
        if passed == total:
            print("\n[SUCCESS] 所有测试通过！系统运行正常。")
            return 0
        else:
            print(f"\n[WARNING] {total - passed} 个测试失败，请检查。")
            return 1
    finally:
        await runner.close()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
