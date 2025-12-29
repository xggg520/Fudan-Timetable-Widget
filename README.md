# Fudan-Timetable-Widget
# 获取你的课程数据并制作成iOS端运行的小组件

功能：在桌面或锁屏界面添加小组件，以显示当前课程及下节课程的科程名称，上课地点，任课教师，时间等信息。该项目只能在iOS平台部署应用

使用说明

1.系统要求
- Python 3.6或更高版本
- iOS 18或26系统

2.安装依赖

在cmd中运行

`pip install requests beautifulsoup4 cryptography`

3.用户信息配置
打开userInfo.json，将学号和密码填入，并保存为json文件。

4.获取课表数据
运行fetch_timetable.py，正确运行后文件夹内会生成timetable.txt。

5.安装所需应用
将js脚本运行为可视小组件的应用为Scriptable，可前往App Store安装https://apps.apple.com/cn/app/scriptable/id1405459188

6.保存课表文件为本地文档
通过邮件或文件传输软件将timetable.txt传输到手机并下载，在“文件”中找到timetable.txt并将其移动到iCloud云盘/Scriptable内。

7.创建小组件
- 打开Scriptable，点击右上角新建脚本，将“复旦课程表.js”中全部代码粘贴进去。然后回到桌面，长按空白处，点击左上角“编辑”，选择“添加小组件”，找到Scriptable，选择小号，中号或大号尺寸。长按小组件。选择“编辑小组件”，Scrip中选择刚才创建的新脚本，回到桌面即可运行。
- 或者将复旦课表.js文件一并移动到iCloud云盘/Scriptable中，即可找到名为“复旦课程表”的脚本。
- 使用同样方法可添加“锁屏课程表”脚本。
- 锁屏界面也可通过长按编辑来添加小组件。



新的更新：下学期课表已经可以由fetch_timetable_next生成，注意替换原有课表时修改文件名为timetable。
